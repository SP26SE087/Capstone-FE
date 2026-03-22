import React, { useMemo } from 'react';
import { Milestone } from '@/types';

interface RoadmapPreviewProps {
    existingMilestones: Milestone[];
    currentMilestones?: Array<{
        id: string;
        name: string;
        startDate: string;
        dueDate: string;
        status?: number;
    }>;
    projectStartDate?: string;
    projectEndDate?: string;
    highlightId?: string; // ID for the milestone being viewed
}

const MilestoneRoadmapPreview: React.FC<RoadmapPreviewProps> = ({
    existingMilestones,
    currentMilestones = [],
    projectStartDate,
    projectEndDate,
    highlightId
}) => {
    const timelineMeta = useMemo(() => {
        const allDates = [
            projectStartDate ? new Date(projectStartDate) : null,
            projectEndDate ? new Date(projectEndDate) : null,
            ...existingMilestones.map(m => m.startDate ? new Date(m.startDate) : null),
            ...existingMilestones.map(m => m.dueDate ? new Date(m.dueDate) : null),
            ...currentMilestones.map(r => r.startDate ? new Date(r.startDate) : null),
            ...currentMilestones.map(r => r.dueDate ? new Date(r.dueDate) : null),
            new Date() // Today
        ].filter((d): d is Date => d !== null && !isNaN(d.getTime()));

        if (allDates.length === 0) return null;

        const min = new Date(Math.min(...allDates.map(d => d.getTime())));
        min.setDate(1); 
        const max = new Date(Math.max(...allDates.map(d => d.getTime())));
        max.setMonth(max.getMonth() + 2); 
        max.setDate(0); 

        return {
            start: min.getTime(),
            end: max.getTime(),
            duration: Math.max(1, max.getTime() - min.getTime())
        };
    }, [projectStartDate, projectEndDate, existingMilestones, currentMilestones]);

    const getX = (dateStr: string | Date) => {
        if (!timelineMeta || !dateStr) return 0;
        const d = new Date(dateStr).getTime();
        return ((d - timelineMeta.start) / timelineMeta.duration) * 100;
    };

    const overlaps = useMemo(() => {
        const results: Record<string, boolean> = {};
        const all = [
            ...existingMilestones.map(m => ({ id: m.id, start: new Date(m.startDate || "").getTime(), end: new Date(m.dueDate || "").getTime() })),
            ...currentMilestones.map(r => ({ id: r.id, start: new Date(r.startDate || "").getTime(), end: new Date(r.dueDate || "").getTime() }))
        ].filter(i => i.start && i.end);

        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                const a = all[i];
                const b = all[j];
                
                // Don't detect overlap with itself (relevant if filtering missed an ID)
                if (a.id === b.id) continue;
                
                if (a.start < b.end && a.end > b.start) {
                    results[a.id] = true;
                    results[b.id] = true;
                }
            }
        }
        return results;
    }, [existingMilestones, currentMilestones]);

    const existingLanes = useMemo(() => {
        const lanes: number[] = [];
        return existingMilestones.map(m => {
            if (!m.startDate || !m.dueDate) return 0;
            const start = new Date(m.startDate).getTime();
            const end = new Date(m.dueDate).getTime();
            let laneIndex = 0;
            // Find first lane where this task's start date is after the previous task's end date
            while (laneIndex < lanes.length && lanes[laneIndex] > start) {
                laneIndex++;
            }
            lanes[laneIndex] = end;
            return laneIndex;
        });
    }, [existingMilestones]);

    const rowLanes = useMemo(() => {
        const lanes: number[] = [];
        return currentMilestones.map(row => {
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
    }, [currentMilestones]);

    // Calculate dynamic height based on total lanes
    const maxExistingLane = existingLanes.length > 0 ? Math.max(...existingLanes) : -1;
    const maxCurrentLane = rowLanes.length > 0 ? Math.max(...rowLanes) : -1;
    const totalHeight = 80 + (maxExistingLane + 1) * 22 + (maxCurrentLane + 1) * 22;

    if (!timelineMeta) return null;

    const months = [];
    let curr = new Date(timelineMeta.start);
    while (curr.getTime() <= timelineMeta.end) {
        months.push(new Date(curr));
        curr.setMonth(curr.getMonth() + 1);
    }

    const hasOverlap = Object.keys(overlaps).length > 0;

    const isNearDeadline = (dueDateStr?: string, statusVal?: number) => {
        if (!dueDateStr) return false;
        if (statusVal === 6 || statusVal === 3) return false; // 6 is Completed for Tasks, 3 is Submitted for Tasks / Completed for Milestones
        const diffDays = (new Date(dueDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return diffDays <= 3;
    };

    return (
        <div style={{
            padding: '0.75rem 1.25rem',
            background: '#fcfdfe',
            borderBottom: '1px solid #f1f5f9'
        }}>
            <style>{`
                @keyframes warningBlink {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.3); }
                }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Roadmap Context</h3>
                    <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Visual project schedule preview</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.55rem', fontWeight: 700, color: '#6366f1' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#e0e7ff' }} /> Existing
                    </div>
                    {currentMilestones.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.55rem', fontWeight: 700, color: '#E8720C' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#E8720C' }} /> {highlightId ? 'Active Phase' : 'Changes'}
                        </div>
                    )}
                    {hasOverlap && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.55rem', fontWeight: 700, color: '#ef4444' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '2px', border: '1.5px solid #ef4444', background: '#fee2e2' }} /> Overlap Warning
                        </div>
                    )}
                </div>
            </div>

            <div style={{ 
                position: 'relative', 
                maxHeight: '130px',
                minHeight: '70px',
                background: 'white', 
                border: '1.5px solid #e2e8f0', 
                borderRadius: '12px',
                overflowY: 'auto',
                overflowX: 'hidden',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }} className="custom-scrollbar-thin">

              {/* Sticky Date Ruler */}
              <div style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 50,
                  height: '20px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0
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
                              <span style={{
                                  fontSize: '0.5rem',
                                  fontWeight: 800,
                                  color: '#475569',
                                  whiteSpace: 'nowrap',
                                  letterSpacing: '0.02em'
                              }}>
                                  {m.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                              </span>
                          </div>
                      );
                  })}
                  {/* Today marker on ruler */}
                  <div style={{
                      position: 'absolute',
                      left: `${getX(new Date())}%`,
                      top: 0,
                      height: '100%',
                      width: '2px',
                      background: '#ef4444',
                      zIndex: 52
                  }}>
                      <span style={{
                          position: 'absolute',
                          top: '50%',
                          left: '4px',
                          transform: 'translateY(-50%)',
                          fontSize: '0.45rem',
                          fontWeight: 900,
                          color: '#ef4444',
                          whiteSpace: 'nowrap'
                      }}>NOW</span>
                  </div>
                </div>
              </div>

              {/* Inner container with real height for scroll */}
              <div style={{
                  position: 'relative',
                  minHeight: `${Math.max(50, totalHeight - 20)}px`,
                  padding: '6px 0'
              }}>
                {/* Today Marker (vertical line through content) */}
                <div style={{
                    position: 'absolute',
                    left: `${getX(new Date())}%`,
                    top: 0,
                    bottom: 0,
                    width: '1.5px',
                    background: 'rgba(239, 68, 68, 0.25)',
                    zIndex: 4
                }} />

                {/* Month Grid Lines */}
                {months.map((m, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        left: `${getX(m)}%`,
                        top: 0,
                        bottom: 0,
                        width: '1px',
                        background: '#f1f5f9',
                        zIndex: 3
                    }} />
                ))}

                {/* Existing Milestones (Sibling Tasks) */}
                {existingMilestones.map((m, i) => {
                    if (!m.startDate || !m.dueDate) return null;
                    const left = getX(m.startDate);
                    const width = Math.max(1, getX(m.dueDate) - left);
                    const isHighlighted = m.id === highlightId;
                    const isConflict = overlaps[m.id];
                    const lane = existingLanes[i] || 0;
                    
                    return (
                        <React.Fragment key={m.id || i}>
                        <div style={{
                            position: 'absolute',
                            left: `${left}%`,
                            width: `${width}%`,
                            top: `${8 + (lane * 22)}px`,
                            height: '16px',
                            background: isConflict ? '#fee2e2' : (isHighlighted ? '#fdf2f8' : '#e0e7ff'),
                            border: isConflict ? '1.5px solid #ef4444' : (isHighlighted ? '1.5px solid #db2777' : '1px solid #818cf8'),
                            borderRadius: '4px',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 6px',
                            overflow: 'hidden',
                            boxShadow: isHighlighted ? '0 0 8px rgba(219, 39, 119, 0.2)' : 'none',
                            transition: 'all 0.3s ease'
                        }}>
                            <span style={{ 
                                fontSize: '0.5rem', 
                                fontWeight: 800, 
                                color: isConflict ? '#b91c1c' : (isHighlighted ? '#9d174d' : '#4338ca'), 
                                whiteSpace: 'nowrap', 
                                textOverflow: 'ellipsis' 
                            }}>
                                {m.name}
                            </span>
                        </div>
                        {isNearDeadline(m.dueDate, m.status) && (
                            <div style={{
                                position: 'absolute',
                                left: `calc(${left + width}% + 4px)`,
                                top: `${14 + (lane * 22)}px`,
                                transform: 'translateY(-50%)',
                                zIndex: 15,
                                flexShrink: 0,
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: '#ef4444', border: '1px solid white',
                                boxShadow: '0 0 6px #ef4444',
                                animation: 'warningBlink 1s ease-in-out infinite'
                            }} title="Deadline is within 3 days or overdue!" />
                        )}
                        </React.Fragment>
                    );
                })}

                {/* Current Entries / Changes */}
                {currentMilestones.map((row, i) => {
                    if (!row.startDate || !row.dueDate) return null;
                    const left = getX(row.startDate);
                    const width = Math.max(1, getX(row.dueDate) - left);
                    const lane = rowLanes[i] || 0;
                    const isConflict = overlaps[row.id];

                    const isHighlighted = row.id === highlightId;
                    const baseTop = 22 + (maxExistingLane + 1) * 22;

                    return (
                        <React.Fragment key={row.id}>
                        <div style={{
                            position: 'absolute',
                            left: `${left}%`,
                            width: `${width}%`,
                            top: `${baseTop + (lane * 22)}px`,
                            height: '18px',
                            background: isConflict ? '#fee2e2' : (isHighlighted ? '#fff7ed' : '#fff7ed'),
                            border: isConflict ? '2px solid #ef4444' : (isHighlighted ? '2.5px solid #E8720C' : '1.5px solid #E8720C'),
                            borderRadius: '5px',
                            zIndex: 20,
                            boxShadow: isConflict ? '0 0 10px rgba(239, 68, 68, 0.2)' : (isHighlighted ? '0 0 12px rgba(232, 114, 12, 0.3)' : '0 2px 4px rgba(232, 114, 12, 0.1)'),
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 6px',
                            overflow: 'hidden',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                            <span style={{ fontSize: '0.55rem', fontWeight: 900, color: isConflict ? '#b91c1c' : '#E8720C', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                {row.name}
                            </span>
                        </div>
                        {isNearDeadline(row.dueDate, row.status) && (
                            <div style={{
                                position: 'absolute',
                                left: `calc(${left + width}% + 4px)`,
                                top: `${baseTop + 9 + (lane * 22)}px`,
                                transform: 'translateY(-50%)',
                                zIndex: 25,
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
              </div>{/* end inner container */}
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

export default MilestoneRoadmapPreview;
