import React, { useMemo, useRef, useState } from 'react';
import { TaskStatus } from '@/types';

interface TaskRoadmapPreviewProps {
    existingTasks: any[];
    newTasks?: Array<{
        id: string;
        name: string;
        startDate: string;
        dueDate: string;
        status?: number;
    }>;
    projectStartDate?: string;
    projectEndDate?: string;
    highlightId?: string;
}

const TaskRoadmapPreview: React.FC<TaskRoadmapPreviewProps> = ({
    existingTasks,
    newTasks = [],
    projectStartDate,
    projectEndDate,
    highlightId
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startY, setStartY] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setStartY(e.pageY - scrollContainerRef.current.offsetTop);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
        setScrollTop(scrollContainerRef.current.scrollTop);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const y = e.pageY - scrollContainerRef.current.offsetTop;
        const walkX = (x - startX) * 1.5; // multiplier for speed
        const walkY = (y - startY) * 1.5;
        scrollContainerRef.current.scrollLeft = scrollLeft - walkX;
        scrollContainerRef.current.scrollTop = scrollTop - walkY;
    };
    const getStatusStyle = (status: number | undefined) => {
        switch (status) {
            case TaskStatus.Todo: return { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', label: 'To Do' };
            case TaskStatus.InProgress: return { color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc', label: 'In Progress' };
            case TaskStatus.Submitted: return { color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', label: 'Submitted' };
            case TaskStatus.Missed: return { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', label: 'Missed' };
            case TaskStatus.Adjusting: return { color: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'Adjusting' };
            case TaskStatus.Completed: return { color: '#047857', bg: '#ecfdf5', border: '#a7f3d0', label: 'Completed' };
            default: return { color: '#475569', bg: '#f8fafc', border: '#e2e8f0', label: 'Planning' };
        }
    };

    const timelineMeta = useMemo(() => {
        const allDates = [
            projectStartDate ? new Date(projectStartDate) : null,
            projectEndDate ? new Date(projectEndDate) : null,
            ...existingTasks.map(t => t.startDate ? new Date(t.startDate) : null),
            ...existingTasks.map(t => t.dueDate ? new Date(t.dueDate) : null),
            ...newTasks.map(r => r.startDate ? new Date(r.startDate) : null),
            ...newTasks.map(r => r.dueDate ? new Date(r.dueDate) : null),
            new Date() // Today
        ].filter((d): d is Date => d !== null && !isNaN(d.getTime()));

        if (allDates.length === 0) return null;

        const min = new Date(Math.min(...allDates.map(d => d.getTime())));
        min.setMonth(min.getMonth() - 2);
        const max = new Date(Math.max(...allDates.map(d => d.getTime())));
        max.setMonth(max.getMonth() + 6);
        max.setDate(0);

        return {
            start: min.getTime(),
            end: max.getTime(),
            duration: Math.max(1, max.getTime() - min.getTime())
        };
    }, [projectStartDate, projectEndDate, existingTasks, newTasks]);

    const getX = (dateStr: string | Date) => {
        if (!timelineMeta || !dateStr) return 0;
        const d = new Date(dateStr).getTime();
        return ((d - timelineMeta.start) / timelineMeta.duration) * 100;
    };

    const existingLanes = useMemo(() => {
        const lanes: number[] = [];
        return existingTasks.map(t => {
            if (!t.startDate || !t.dueDate) return 0;
            const start = new Date(t.startDate).getTime();
            const end = new Date(t.dueDate).getTime();
            let laneIndex = 0;
            while (laneIndex < lanes.length && lanes[laneIndex] > start) {
                laneIndex++;
            }
            lanes[laneIndex] = end;
            return laneIndex;
        });
    }, [existingTasks]);

    const rowLanes = useMemo(() => {
        const lanes: number[] = [];
        return newTasks.map(row => {
            if (!row.startDate || !row.dueDate) return 0;
            const start = new Date(row.startDate).getTime();
            const end = new Date(row.dueDate).getTime();
            let laneIndex = 0;
            while (laneIndex < lanes.length && lanes[laneIndex] > start) {
                laneIndex++;
            }
            lanes[laneIndex] = end;
            return laneIndex;
        });
    }, [newTasks]);

    const maxExistingLane = existingLanes.length > 0 ? Math.max(...existingLanes) : -1;
    const maxCurrentLane = rowLanes.length > 0 ? Math.max(...rowLanes) : -1;
    const laneHeight = 21;
    const totalHeight = 70 + (maxExistingLane + 1) * laneHeight + (maxCurrentLane + 1) * laneHeight;

    if (!timelineMeta) return null;

    const months = [];
    let curr = new Date(timelineMeta.start);
    while (curr.getTime() <= timelineMeta.end) {
        months.push(new Date(curr));
        curr.setMonth(curr.getMonth() + 1);
    }

    const isNearDeadline = (dueDateStr?: string, statusVal?: number) => {
        if (!dueDateStr) return false;
        if (statusVal === 6 || statusVal === 3) return false;
        const diffDays = (new Date(dueDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return diffDays <= 3;
    };

    return (
        <div style={{ padding: '0.75rem 1.25rem', background: '#fcfdfe', borderBottom: '1px solid #f1f5f9' }}>
            <style>{`
                @keyframes warningBlink {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.3); }
                }
                .roadmap-scroll-container::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .roadmap-scroll-container::-webkit-scrollbar-track {
                    background: transparent;
                }
                .roadmap-scroll-container::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .roadmap-scroll-container::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Activities Roadmap</h3>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Visual schedule of research activities</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {[TaskStatus.Todo, TaskStatus.InProgress, TaskStatus.Adjusting, TaskStatus.Submitted, TaskStatus.Completed, TaskStatus.Missed].map(s => {
                        const style = getStatusStyle(s);
                        return (
                            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6rem', fontWeight: 700, color: style.color }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: style.bg, border: `1px solid ${style.border}` }} />
                                {style.label}
                            </div>
                        );
                    })}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6rem', fontWeight: 700, color: '#475569' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f8fafc', border: '1px solid #e2e8f0' }} />
                        Drafts
                    </div>
                </div>
            </div>

            <div 
                ref={scrollContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                style={{
                    position: 'relative',
                    maxHeight: '525px',
                    minHeight: '280px',
                    background: 'white',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '12px',
                    overflowY: 'auto',
                    overflowX: 'auto', // Changed to auto
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none'
                }} 
                className="roadmap-scroll-container custom-scrollbar-thin"
            >

                <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                    height: '25px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    minWidth: '1500px' // Added horizontal space
                }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        {months.map((m, i) => {
                            const leftPos = getX(m);
                            return (
                                <div key={i} style={{
                                    position: 'absolute',
                                    left: `${leftPos}%`,
                                    top: 0,
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderLeft: '1px solid #e2e8f0',
                                    paddingLeft: '5px',
                                    zIndex: 51
                                }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                                        {m.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                    </span>
                                </div>
                            );
                        })}
                        <div
                            title="Current Date (Ngày hiện tại)"
                            style={{ position: 'absolute', left: `${getX(new Date())}%`, top: 0, height: '100%', width: '1.5px', background: '#ef4444', zIndex: 52 }}
                        />
                    </div>
                </div>

                <div style={{
                    position: 'relative',
                    minHeight: `${Math.max(280, totalHeight - 15)}px`,
                    minWidth: '1500px', // Added horizontal space
                    padding: '6px 0'
                }}>
                    <div
                        title="Current Date (Ngày hiện tại)"
                        style={{
                            position: 'absolute',
                            left: `${getX(new Date())}%`,
                            top: 0,
                            bottom: 0,
                            width: '2px', // Slightly thicker
                            background: 'rgba(239, 68, 68, 0.5)',
                            zIndex: 4
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            bottom: '8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: '0.55rem',
                            fontWeight: 800,
                            color: '#ef4444',
                            whiteSpace: 'nowrap',
                            background: 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1.5px solid #ef4444',
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ef4444' }} />
                            Nowadays: {new Date().toLocaleDateString('vi-VN')}
                        </div>
                    </div>
                    {months.map((m, i) => (
                        <div key={i} style={{ position: 'absolute', left: `${getX(m)}%`, top: 0, bottom: 0, width: '1px', background: '#f1f5f9', zIndex: 3 }} />
                    ))}

                    {existingTasks.map((t, i) => {
                        if (!t.startDate || !t.dueDate) return null;
                        const left = getX(t.startDate);
                        const width = Math.max(1, getX(t.dueDate) - left);
                        const isHighlighted = t.id === highlightId;
                        const lane = existingLanes[i] || 0;
                        const style = getStatusStyle(t.status);

                        return (
                            <React.Fragment key={t.id || i}>
                                <div style={{
                                    position: 'absolute',
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    top: `${7 + (lane * 21)}px`,
                                    height: '14px',
                                    background: style.bg,
                                    border: isHighlighted ? `2px solid ${style.color}` : `1px solid ${style.border}`,
                                    borderRadius: '4px',
                                    zIndex: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 8px',
                                    overflow: 'hidden',
                                    boxShadow: isHighlighted ? `0 0 10px ${style.bg}` : 'none',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: style.color, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                        {t.name}
                                    </span>
                                </div>
                                {isNearDeadline(t.dueDate, t.status) && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `calc(${left + width}% + 4px)`,
                                        top: `${10 + (lane * 21)}px`,
                                        transform: 'translateY(-50%)',
                                        zIndex: 15,
                                        flexShrink: 0,
                                        width: '6px', height: '6px', borderRadius: '50%',
                                        background: '#ef4444', border: '1.5px solid white',
                                        boxShadow: '0 0 6px #ef4444',
                                        animation: 'warningBlink 1s ease-in-out infinite'
                                    }} title="Deadline is within 3 days or overdue!" />
                                )}
                            </React.Fragment>
                        );
                    })}

                    {newTasks.map((row, i) => {
                        if (!row.startDate || !row.dueDate) return null;
                        const left = getX(row.startDate);
                        const width = Math.max(1, getX(row.dueDate) - left);
                        const lane = rowLanes[i] || 0;
                        const isHighlighted = row.id === highlightId;
                        const baseTop = 28 + (maxExistingLane + 1) * 21;
                        const style = getStatusStyle(row.status);

                        return (
                            <React.Fragment key={row.id}>
                                <div style={{
                                    position: 'absolute',
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    top: `${baseTop + (lane * 21)}px`,
                                    height: '17px',
                                    background: style.bg,
                                    border: isHighlighted ? `2.5px solid ${style.color}` : `1.5px solid ${style.border}`,
                                    borderRadius: '6px',
                                    zIndex: 20,
                                    boxShadow: isHighlighted ? `0 0 12px ${style.bg}` : '0 2px 4px rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 12px',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: style.color, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                        {row.name}
                                    </span>
                                </div>
                                {isNearDeadline(row.dueDate, row.status) && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `calc(${left + width}% + 4px)`,
                                        top: `${baseTop + 8.5 + (lane * 21)}px`,
                                        transform: 'translateY(-50%)',
                                        zIndex: 25,
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: '#ef4444', border: '1.5px solid white',
                                        boxShadow: '0 0 8px #ef4444',
                                        animation: 'warningBlink 1s ease-in-out infinite'
                                    }} title="Deadline is within 3 days or overdue!" />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', opacity: 0.5 }}>
                <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 600 }}>
                    {projectStartDate ? new Date(projectStartDate).toLocaleDateString() : 'START N/A'}
                </span>
                <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 600 }}>
                    {projectEndDate ? new Date(projectEndDate).toLocaleDateString() : 'END N/A'}
                </span>
            </div>
        </div>
    );
};

export default TaskRoadmapPreview;
