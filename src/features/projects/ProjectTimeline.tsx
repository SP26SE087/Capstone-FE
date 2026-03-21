import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Project, Milestone, MilestoneStatus, Task, TaskStatus } from '@/types';
import { Plus, Minus, ChevronRight, ChevronDown, CalendarClock } from 'lucide-react';
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

const ProjectTimeline: React.FC<ProjectTimelineProps> = ({
    project,
    timelineData,
    onTaskClick,
    onMilestoneClick
}) => {
    // 1. State & Refs
    const [zoomLevel, setZoomLevel] = useState(6);
    const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
    const hasInitialFocused = useRef(false); // Only focus once on load
    const [isOrphanExpanded, setIsOrphanExpanded] = useState(false);
    const [hoverInfo, setHoverInfo] = useState<{ task: Task; x: number; y: number } | null>(null);
    const [hoverMilestone, setHoverMilestone] = useState<{ milestone: Milestone; x: number; y: number } | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // --- Drag to Scroll State ---
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startY = useRef(0);
    const scrollLeft = useRef(0);
    const scrollTop = useRef(0);
    const [cursor, setCursor] = useState<'grab' | 'grabbing'>('grab');

    const toggleMilestone = (id: string) => {
        const next = new Set(expandedMilestones);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedMilestones(next);
    };

    const scrollToMilestone = (x: number) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                left: x - 100,
                behavior: 'smooth'
            });
        }
    };

    // 2. Drag to Scroll Events
    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        setCursor('grabbing');
        startX.current = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
        startY.current = e.pageY - (scrollContainerRef.current?.offsetTop || 0);
        scrollLeft.current = scrollContainerRef.current?.scrollLeft || 0;
        scrollTop.current = scrollContainerRef.current?.scrollTop || 0;
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        setCursor('grab');
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !scrollContainerRef.current) return;
        e.preventDefault();
        
        const x = e.pageX - (scrollContainerRef.current.offsetLeft || 0);
        const y = e.pageY - (scrollContainerRef.current.offsetTop || 0);
        
        const walkX = (x - startX.current) * 1.5; 
        const walkY = (y - startY.current) * 1.5; 
        
        scrollContainerRef.current.scrollLeft = scrollLeft.current - walkX;
        scrollContainerRef.current.scrollTop = scrollTop.current - walkY;
    };

    // 3. Data Processing (Using Structured API Data)

    // a. Active Filter: Still apply the "khởi hành" (Started) rule
    // Show milestones that are InProgress/Completed OR have at least one InProgress+ task
    const activeMilestonesData = useMemo(() => {
        if (!timelineData) return [];
        return timelineData.milestones
            .filter(item => {
                const m = item.milestone;
                const hasActiveTasks = item.tasks.some(t => t.status >= TaskStatus.InProgress);
                return m.status >= MilestoneStatus.InProgress || hasActiveTasks;
            })
            .sort((a, b) => new Date(a.milestone.startDate || "").getTime() - new Date(b.milestone.startDate || "").getTime());
    }, [timelineData]);

    const activeOrphanTasks = useMemo(() => {
        if (!timelineData) return [];
        return timelineData.generalTasks.filter(t => t.status >= TaskStatus.InProgress);
    }, [timelineData]);

    // Flatten for range calculations
    const allActiveTasks = useMemo(() => {
        const tasksFromMilestones = activeMilestonesData.flatMap(item =>
            item.tasks.filter(t => t.status >= TaskStatus.InProgress)
        );
        return [...tasksFromMilestones, ...activeOrphanTasks];
    }, [activeMilestonesData, activeOrphanTasks]);

    // 4. Timeline Range Logic
    const range = useMemo(() => {
        const allDates = [
            new Date(project.startDate || ""),
            new Date(project.endDate || ""),
            // Include ALL milestones provided by API, not just active ones
            ...(timelineData?.milestones.map(item => new Date(item.milestone.dueDate || "")) || []),
            ...(timelineData?.milestones.map(item => new Date(item.milestone.startDate || "")) || []),
            // Include ALL tasks to ensure range covers everything
            ...(timelineData?.milestones.flatMap(item => item.tasks.map(t => new Date(t.startDate || ""))) || []),
            ...(timelineData?.milestones.flatMap(item => item.tasks.map(t => new Date(t.dueDate || ""))) || []),
            ...(timelineData?.generalTasks.map(t => new Date(t.startDate || "")) || []),
            ...(timelineData?.generalTasks.map(t => new Date(t.dueDate || "")) || [])
        ].filter(d => !isNaN(d.getTime()));

        if (allDates.length === 0) return { start: Date.now(), end: Date.now() + 86400000, duration: 86400000 };

        const start = new Date(Math.min(...allDates.map(d => d.getTime())));
        start.setDate(1);
        const end = new Date(Math.max(...allDates.map(d => d.getTime())));
        end.setMonth(end.getMonth() + 4); // Future padding (4 months instead of 2)
        end.setDate(0); 

        return {
            start: start.getTime(),
            end: end.getTime(),
            duration: Math.max(1, end.getTime() - start.getTime())
        };
    }, [project, activeMilestonesData, allActiveTasks]);

    // 5. Scale
    const days = range.duration / (24 * 60 * 60 * 1000);
    const contentWidth = Math.max(800, days * zoomLevel);
    const leftSidebarWidth = 210; // More compact sidebar

    // 6. Staggered Milestone Flags Logic
    const staggeredFlags = useMemo(() => {
        if (activeMilestonesData.length === 0) return [];
        const levels: { x: number; width: number; height: number }[] = [];
        const labelWidth = 50;

        return activeMilestonesData.map(item => {
            const m = item.milestone;
            const x = ((new Date(m.dueDate || "").getTime() - range.start) / range.duration) * contentWidth;
            let level = 0;
            while (true) {
                const hasOverlap = levels.some(l => l.height === level && Math.abs(l.x - x) < labelWidth);
                if (!hasOverlap) break;
                level++;
            }
            levels.push({ x, width: labelWidth, height: level });
            return { ...m, x, level };
        });
    }, [activeMilestonesData, range, contentWidth, zoomLevel]);

    const maxFlagLevel = Math.max(0, ...staggeredFlags.map(f => f.level));
    const flagAreaHeight = 60 + (maxFlagLevel * 40);

    // 7. Grid Generation
    const months = useMemo(() => {
        const result = [];
        let curr = new Date(range.start);
        while (curr.getTime() <= range.end) {
            result.push(new Date(curr));
            curr.setMonth(curr.getMonth() + 1);
        }
        return result;
    }, [range]);

    // 8. Auto-Focus Logic (Initial Load)
    useEffect(() => {
        if (!timelineData || hasInitialFocused.current) return;
        if (timelineData.milestones.length === 0) return;

        const inProgress = timelineData.milestones.filter(m => m.milestone.status === MilestoneStatus.InProgress);
        const completed = timelineData.milestones.filter(m => m.milestone.status === MilestoneStatus.Completed);

        let targetId: string | null = null;
        let expandIds: string[] = [];

        if (inProgress.length > 0) {
            // Priority 1: All In Progress
            expandIds = inProgress.map(m => m.milestone.id);
            // Nearest to TODAY (by start date)
            const now = new Date().getTime();
            targetId = inProgress.sort((a,b) => {
                const da = Math.abs(new Date(a.milestone.startDate || "").getTime() - now);
                const db = Math.abs(new Date(b.milestone.startDate || "").getTime() - now);
                return da - db;
            })[0].milestone.id;
        } else if (completed.length > 0) {
            // Priority 2: All Completed (if no InProgress)
            expandIds = completed.map(m => m.milestone.id);
            // Latest Completed (recently finished)
            targetId = completed.sort((a,b) => 
                new Date(b.milestone.dueDate || "").getTime() - new Date(a.milestone.dueDate || "").getTime()
            )[0].milestone.id;
        }

        if (expandIds.length > 0) {
            setExpandedMilestones(new Set(expandIds));
            hasInitialFocused.current = true; // Mark as done

            if (targetId) {
                const mData = timelineData.milestones.find(m => m.milestone.id === targetId);
                if (mData) {
                    const x = ((new Date(mData.milestone.startDate || mData.milestone.dueDate || "").getTime() - range.start) / range.duration) * contentWidth;
                    // Slightly delay to ensure layout is ready
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
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5rem 2rem',
                background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                borderRadius: '30px',
                border: '1.5px solid #e2e8f0',
                margin: '1.5rem 0',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Decorative Background Elements */}
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'rgba(232, 114, 12, 0.03)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '-30px', left: '-30px', width: '120px', height: '120px', background: 'rgba(59, 130, 246, 0.03)', borderRadius: '50%' }} />

                <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '28px',
                    background: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#E8720C',
                    marginBottom: '2rem',
                    boxShadow: '0 15px 30px -10px rgba(232, 114, 12, 0.2)',
                    border: '1px solid rgba(232, 114, 12, 0.1)',
                    animation: 'floatIcon 3s ease-in-out infinite'
                }}>
                    <CalendarClock size={48} strokeWidth={1.5} />
                </div>
                
                <h3 style={{ 
                    margin: '0 0 0.75rem', 
                    color: '#1e293b', 
                    fontSize: '1.5rem', 
                    fontWeight: 900,
                    letterSpacing: '-0.025em'
                }}>No Roadmap Content Found</h3>
                
                <p style={{ 
                    margin: 0, 
                    color: '#64748b', 
                    fontSize: '1rem', 
                    textAlign: 'center',
                    maxWidth: '480px',
                    lineHeight: 1.7,
                    fontWeight: 500
                }}>
                    {timelineData.milestones.length > 0 || timelineData.generalTasks.length > 0 
                        ? "Your roadmap is currently in a setup phase. Complete the initialization of your milestones or start tracking activities to see them populated here."
                        : "Start defining your research journey. Once you add milestones and trackable activities, a visual timeline of your project's progress will appear."}
                </p>

                <div style={{ 
                    display: 'flex', 
                    gap: '24px', 
                    marginTop: '2.5rem',
                    background: 'rgba(255, 255, 255, 0.6)',
                    padding: '12px 24px',
                    borderRadius: '16px',
                    border: '1px solid white',
                    backdropFilter: 'blur(8px)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>
                        <div style={{ width: '8px', height: '8px', background: '#E8720C', borderRadius: '50%' }} />
                        Roadmap Phases
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>
                        <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%' }} />
                        Research Activities
                    </div>
                </div>

                <style>{`
                    @keyframes floatIcon {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-12px); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflow: 'hidden', height: '100%', position: 'relative' }}>
            {/* Compact Header Controls (Removed large title) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', background: '#f8fafc', borderRadius: '6px', padding: '2px', border: '1px solid #e2e8f0' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setZoomLevel(prev => Math.max(3, prev - 2)); }}
                        style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}
                        title="Zoom Out"
                    >
                        <Minus size={14} />
                    </button>
                    <div style={{ padding: '0 8px', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', color: '#475569', minWidth: '50px', justifyContent: 'center' }}>
                        {Math.round((zoomLevel / 6) * 100)}%
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setZoomLevel(prev => Math.min(50, prev + 2)); }}
                        style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}
                        title="Zoom In"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            <div className="card" style={{
                padding: 0,
                maxHeight: 'calc(100vh - 280px)', // Constrain height
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                background: 'white',
                boxShadow: '0 10px 40px -15px rgba(0,0,0,0.06)',
                cursor: cursor
            }}>
                <div
                    ref={scrollContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseUp}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    className="custom-scrollbar-thin"
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    <div style={{
                        width: `${contentWidth + leftSidebarWidth}px`,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 'auto', // Let maxHeight handle it
                        userSelect: isDragging.current ? 'none' : 'auto'
                    }}>

                        {/* ─── 0. UNIFIED STICKY HEADER (LABELS + FLAGS + RULER) ─── */}
                        <div style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 400,
                            background: 'white',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)',
                            borderBottom: '1.5px solid #e2e8f0'
                        }}>
                            {/* Flags Row */}
                            <div style={{ display: 'flex' }}>
                                <div style={{
                                    width: `${leftSidebarWidth}px`,
                                    background: '#f8fafc',
                                    borderRight: '1.5px solid #e2e8f0',
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 410,
                                    paddingRight: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    justifyContent: 'flex-end',
                                    paddingBottom: '0.6rem',
                                    boxShadow: 'inset -2px 0 5px rgba(0,0,0,0.01)'
                                }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.55rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '2px' }}>Workspace</div>
                                        <div style={{ fontSize: '0.75rem', color: '#1e293b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Roadmap</div>
                                    </div>
                                </div>
                                <div style={{
                                    height: `${flagAreaHeight}px`,
                                    width: `${contentWidth}px`, // Force full width for absolute children
                                    flexShrink: 0,
                                    position: 'relative',
                                    background: '#fcfdfe',
                                    borderBottom: '1px solid #f1f5f9'
                                }}>
                                    {staggeredFlags.map((m) => {
                                        const isDone = m.status === MilestoneStatus.Completed;
                                        const color = isDone ? '#10b981' : 'var(--primary-color)';
                                        const baseTop = 10;
                                        const top = baseTop + (m.level * 30);

                                        return (
                                            <div
                                                key={m.id}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${m.x}px`,
                                                    top: `${top}px`,
                                                    transform: 'translateX(-50%)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    zIndex: 50,
                                                    cursor: 'pointer'
                                                }}
                                                onMouseEnter={(e) => setHoverMilestone({ milestone: m, x: e.clientX, y: e.clientY })}
                                                onMouseMove={(e) => setHoverMilestone({ milestone: m, x: e.clientX, y: e.clientY })}
                                                onMouseLeave={() => setHoverMilestone(null)}
                                                onClick={(e) => { e.stopPropagation(); onMilestoneClick(m); }}
                                            >
                                                <div style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    background: 'white',
                                                    border: `2px solid ${color}`,
                                                    color: color,
                                                    borderRadius: '50%',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 900,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                                                    textTransform: 'uppercase',
                                                    transition: 'transform 0.2s',
                                                    position: 'relative'
                                                }}>
                                                    {m.name.charAt(0)}
                                                    {isDone && (
                                                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, background: '#10b981', border: '1px solid white', borderRadius: '50%' }} />
                                                    )}
                                                </div>
                                                <div style={{ width: '1.5px', height: `${flagAreaHeight - top - 12}px`, background: color, opacity: 0.3 }} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Ruler Row */}
                            <div style={{ display: 'flex', height: '30px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                                <div style={{
                                    width: `${leftSidebarWidth}px`,
                                    background: '#f8fafc',
                                    borderRight: '1.5px solid #e2e8f0',
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 410,
                                    boxShadow: 'inset -2px 0 5px rgba(0,0,0,0.01)'
                                }} />
                                <div style={{
                                    width: `${contentWidth}px`, // Force full width for absolute children
                                    flexShrink: 0,
                                    position: 'relative'
                                }}>
                                    {months.map((d, i) => {
                                        const left = ((d.getTime() - range.start) / range.duration) * contentWidth;
                                        return (
                                            <div key={i} style={{
                                                position: 'absolute',
                                                left: `${left}px`,
                                                fontSize: '0.65rem',
                                                fontWeight: 800,
                                                color: '#334155',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                borderLeft: '1.5px solid #e2e8f0',
                                                paddingLeft: '10px'
                                            }}>
                                                {d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                                         {/* ─── 3. TIMELINE CONTENT (UNIFIED ROWS: SIDEBAR + GRID) ─── */}
                        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            {/* Global Grid Lines Layer */}
                            <div style={{ position: 'absolute', top: 0, left: `${leftSidebarWidth}px`, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0 }}>
                                {months.map((d, j) => {
                                    const left = ((d.getTime() - range.start) / range.duration) * contentWidth;
                                    return (
                                        <div key={j} style={{ position: 'absolute', left: `${left}px`, top: 0, bottom: 0, width: '1.5px', background: '#f1f5f9' }} />
                                    );
                                })}
                            </div>

                            {/* Aligned Rows (Milestones) */}
                            {activeMilestonesData.map((item) => {
                                const milestone = item.milestone;
                                const mTasks = item.tasks.filter(t => t.status >= TaskStatus.InProgress);
                                const isExpanded = expandedMilestones.has(milestone.id);
                                const mX = ((new Date(milestone.dueDate || "").getTime() - range.start) / range.duration) * contentWidth;

                                return (
                                    <div key={milestone.id} style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', minHeight: '50px' }}>
                                        {/* SIDEBAR PART (Sticky Left) */}
                                        <div style={{ 
                                            width: `${leftSidebarWidth}px`, 
                                            flexShrink: 0, 
                                            borderRight: '1.5px solid #e2e8f0',
                                            background: isExpanded ? '#f8fafc' : '#fcfdfe',
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 110,
                                            padding: '0.75rem 0.6rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div 
                                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
                                                    onClick={(e) => { e.stopPropagation(); scrollToMilestone(mX); }}
                                                >
                                                    <div style={{ width: '4px', height: '14px', borderRadius: '4px', background: 'var(--primary-color)' }} />
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e293b' }}>{milestone.name}</span>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); toggleMilestone(milestone.id); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
                                                >
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                            </div>
                                            {isExpanded && milestone.description && (
                                                <p style={{ margin: '0 0 2px', fontSize: '0.65rem', color: '#64748b', lineHeight: 1.4, paddingLeft: '12px', borderLeft: '1px dashed #cbd5e1' }}>
                                                    {milestone.description}
                                                </p>
                                            )}
                                            <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, paddingLeft: '12px' }}>
                                                {mTasks.length} Activities
                                            </div>
                                        </div>

                                        {/* GRID PART (Task Bars) */}
                                        <div style={{ width: `${contentWidth}px`, flexShrink: 0, position: 'relative', padding: isExpanded ? '10px 0' : '0' }}>
                                            {isExpanded && mTasks.map((task, index) => {
                                                const tStart = new Date(task.startDate || milestone.startDate || "").getTime();
                                                const tEnd = new Date(task.dueDate || task.startDate || milestone.startDate || "").getTime();
                                                const left = ((tStart - range.start) / range.duration) * contentWidth;
                                                const width = Math.max(10, ((tEnd - tStart) / range.duration) * contentWidth);
                                                const isTaskDone = task.status === TaskStatus.Completed;
                                                const taskColor = isTaskDone ? '#10b981' : 'var(--accent-color)';

                                                return (
                                                    <div key={task.id} style={{ height: '32px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                        <div
                                                            onMouseEnter={(e) => setHoverInfo({ task, x: e.clientX, y: e.clientY })}
                                                            onMouseMove={(e) => setHoverInfo({ task, x: e.clientX, y: e.clientY })}
                                                            onMouseLeave={() => setHoverInfo(null)}
                                                            onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                                            className="timeline-item-bar"
                                                            style={{
                                                                position: 'absolute',
                                                                left: `${left}px`,
                                                                width: `${width}px`,
                                                                height: '24px',
                                                                background: isTaskDone ? '#ecfdf5' : '#fff7ed',
                                                                border: `1.5px solid ${taskColor}`,
                                                                borderRadius: '12px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                padding: '0 10px',
                                                                cursor: 'pointer',
                                                                zIndex: 10,
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            <span style={{ fontSize: '0.6rem', color: isTaskDone ? '#059669' : '#c2410c', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {task.name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Orpan Tasks (General Activities) */}
                            {activeOrphanTasks.length > 0 && (
                                <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', minHeight: '50px' }}>
                                    {/* SIDEBAR PART */}
                                    <div style={{ 
                                        width: `${leftSidebarWidth}px`, 
                                        flexShrink: 0, 
                                        borderRight: '1.5px solid #e2e8f0',
                                        background: isOrphanExpanded ? '#f8fafc' : '#fcfdfe',
                                        position: 'sticky',
                                        left: 0,
                                        zIndex: 110,
                                        padding: '0.75rem 0.6rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '4px', height: '14px', borderRadius: '4px', background: '#64748b' }} />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>General Activities</span>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setIsOrphanExpanded(!isOrphanExpanded); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
                                            >
                                                {isOrphanExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                        </div>
                                        <p style={{ margin: '0', fontSize: '0.6rem', color: '#94a3b8', paddingLeft: '12px' }}>Independent research tasks</p>
                                    </div>

                                    {/* GRID PART */}
                                    <div style={{ width: `${contentWidth}px`, flexShrink: 0, position: 'relative', padding: isOrphanExpanded ? '10px 0' : '0' }}>
                                        {isOrphanExpanded && activeOrphanTasks.map((task) => {
                                            const tStart = new Date(task.startDate || project.startDate || "").getTime();
                                            const tEnd = new Date(task.dueDate || task.startDate || project.startDate || "").getTime();
                                            const left = ((tStart - range.start) / range.duration) * contentWidth;
                                            const width = Math.max(10, ((tEnd - tStart) / range.duration) * contentWidth);
                                            const isTaskDone = task.status === TaskStatus.Completed;
                                            
                                            return (
                                                <div key={task.id} style={{ height: '32px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <div
                                                        onMouseEnter={(e) => setHoverInfo({ task, x: e.clientX, y: e.clientY })}
                                                        onMouseMove={(e) => setHoverInfo({ task, x: e.clientX, y: e.clientY })}
                                                        onMouseLeave={() => setHoverInfo(null)}
                                                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${left}px`,
                                                            width: `${width}px`,
                                                            height: '24px',
                                                            background: isTaskDone ? '#f1f5f9' : '#f8fafc',
                                                            border: '1.2px solid #cbd5e1',
                                                            borderRadius: '12px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            padding: '0 10px',
                                                            cursor: 'pointer',
                                                            zIndex: 10
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {task.name}
                                                        </span>
                                                    </div>
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

            {/* Float Tooltips */}
            {(hoverInfo || hoverMilestone) && (
                <div style={{
                    position: 'fixed',
                    top: (hoverInfo?.y || hoverMilestone?.y || 0) + 20,
                    left: (hoverInfo?.x || hoverMilestone?.x || 0) + 20,
                    background: 'rgba(15, 23, 42, 0.98)',
                    color: 'white',
                    padding: '1rem',
                    borderRadius: '12px',
                    zIndex: 2000,
                    width: '320px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(12px)',
                    pointerEvents: 'none',
                    animation: 'tooltipIn 0.2s ease-out'
                }}>
                    {hoverInfo ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <div style={{ width: '10px', height: '10px', background: 'var(--accent-color)', borderRadius: '50%', boxShadow: '0 0 10px rgba(232, 114, 12, 0.5)' }} />
                                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{hoverInfo.task.name}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                    <span>Schedule</span>
                                    <span style={{ color: 'white' }}>{formatProjectDate(hoverInfo.task.startDate)} — {formatProjectDate(hoverInfo.task.dueDate)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                    <span>Status</span>
                                    <span style={{ fontWeight: 800, color: hoverInfo.task.status === TaskStatus.Completed ? '#10b981' : '#3b82f6' }}>
                                        {TaskStatus[hoverInfo.task.status]}
                                    </span>
                                </div>
                                {hoverInfo.task.description && (
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '8px', paddingTop: '8px', fontSize: '0.7rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                                        {hoverInfo.task.description}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <div style={{ width: '10px', height: '10px', background: 'var(--primary-color)', borderRadius: '50%', boxShadow: '0 0 10px rgba(71, 101, 246, 0.5)' }} />
                                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Milestone: {hoverMilestone?.milestone.name}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                    <span>Deadline</span>
                                    <span style={{ color: 'white' }}>{formatProjectDate(hoverMilestone?.milestone.dueDate)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                    <span>Status</span>
                                    <span style={{ fontWeight: 800, color: hoverMilestone?.milestone.status === MilestoneStatus.Completed ? '#10b981' : '#E8720C' }}>
                                        {MilestoneStatus[hoverMilestone?.milestone.status || 0]}
                                    </span>
                                </div>
                                {hoverMilestone?.milestone.description && (
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '8px', paddingTop: '8px', fontSize: '0.7rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                                        {hoverMilestone.milestone.description}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            <style>{`
                @keyframes tooltipIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .timeline-item-bar {
                    transition: transform 0.1s, box-shadow 0.1s, background 0.2s;
                }
                .timeline-item-bar:active {
                    cursor: grabbing !important;
                }
                .timeline-item-bar:hover {
                    transform: scaleY(1.1);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.1) !important;
                    z-index: 20 !important;
                }
                .custom-scrollbar-thin::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar-thin::-webkit-scrollbar-track {
                    background: #f8fafc;
                }
                .custom-scrollbar-thin::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 20px;
                    border: 1px solid #f8fafc;
                }
                .custom-scrollbar-thin::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </div>
    );
};

export default ProjectTimeline;
