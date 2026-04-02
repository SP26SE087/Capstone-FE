import React, { useState, useEffect, useMemo } from 'react';
import { 
    Clock, Loader2, Info, List
} from 'lucide-react';
import { Milestone, Task } from '@/types';
import { taskService } from '@/services/taskService';
import { membershipService } from '@/services/membershipService';

interface TimelineActivity {
    id: string;
    performedBy: string;
    action: string;
    createdAt: string;
    performedByFullName: string;
    performedByEmail: string;
}

interface TaskWithActivities extends Task {
    statusActivities: TimelineActivity[];
}

interface ActivityTimelineProps {
    milestones: Milestone[];
    projectMembers: any[];
    currentMember: any;
    projectId: string; 
    isSpecialRole: boolean;
    viewMode: 'list' | 'timeline';
    setViewMode: (mode: 'list' | 'timeline') => void;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
    projectId,
    milestones,
    projectMembers,
    currentMember,
    isSpecialRole,
    // viewMode,
    setViewMode
}) => {
    const [timelineMode, setTimelineMode] = useState<'milestone' | 'member'>('milestone');
    const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');
    const [activities, setActivities] = useState<TaskWithActivities[]>([]);
    const [loading, setLoading] = useState(false);
    const [localMembers, setLocalMembers] = useState<any[]>(projectMembers || []);
    
    // Modal State
    const [selectedDetailTask, setSelectedDetailTask] = useState<{ details: any, activities: any[] } | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const initializedForProject = React.useRef<string | null>(null);

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const resolveMemberId = (m: any) => {
        if (!m) return '';
        const id = m.membershipId || m.id || m.memberId;
        return (id && isUUID(id)) ? id : '';
    };
    
    const findMemberRecord = (idValue: string, list: any[]) => {
        if (!idValue) return null;
        return list.find(m => 
            m.membershipId === idValue || 
            m.userId === idValue || 
            m.id === idValue || 
            m.memberId === idValue
        );
    };

    const resolveMilestoneId = (m: any) => m?.milestoneId || m?.id;

    useEffect(() => {
        const fetchMembers = async () => {
            if (!projectId) return;
            try {
                const members = await membershipService.getProjectMembers(projectId);
                if (members && Array.isArray(members)) {
                    setLocalMembers(members);
                }
            } catch (err) {
                console.error('Failed to fetch internal project members:', err);
            }
        };
        fetchMembers();
    }, [projectId]);

    useEffect(() => {
        if (localMembers.length > 0 && milestones.length > 0 && initializedForProject.current !== projectId) {
            const milestoneExists = milestones.some(m => resolveMilestoneId(m) === selectedMilestoneId);
            if (!selectedMilestoneId || !milestoneExists) {
                setSelectedMilestoneId(resolveMilestoneId(milestones[0]));
            }

            const myId = currentMember?.membershipId || currentMember?.id || currentMember?.userId;
            const myRecord = findMemberRecord(myId, localMembers);
            
            if (myRecord) {
                const validId = resolveMemberId(myRecord);
                if (validId) setSelectedMemberId(validId);
            } else {
                const firstValid = localMembers.find(m => isUUID(resolveMemberId(m)));
                if (firstValid) setSelectedMemberId(resolveMemberId(firstValid));
            }

            initializedForProject.current = projectId;
        }
    }, [localMembers, milestones, projectId, currentMember, selectedMilestoneId]);
    
    const fetchData = React.useCallback(async () => {
        if (timelineMode === 'milestone') {
            if (!selectedMilestoneId) return;
        } else {
            if (!selectedMemberId) return;
        }

        setLoading(true);
        try {
            let data: TaskWithActivities[] = [];
            if (timelineMode === 'milestone') {
                data = await taskService.getActivitiesByMilestone(selectedMilestoneId);
            } else {
                data = await taskService.getActivitiesByMember(selectedMemberId);
            }
            setActivities(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch activities:', error);
            setActivities([]);
        } finally {
            setLoading(false);
        }
    }, [timelineMode, selectedMilestoneId, selectedMemberId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTaskClick = async (taskId: string) => {
        setDetailLoading(true);
        try {
            const [details, activityResponse] = await Promise.all([
                taskService.getById(taskId),
                taskService.getActivitiesByTask(taskId)
            ]);
            
            // Extract activities: handle direct array or object with statusActivities property
            const activities = Array.isArray(activityResponse) 
                ? activityResponse 
                : (activityResponse?.statusActivities || activityResponse?.data?.statusActivities || []);
                
            setSelectedDetailTask({ details, activities });
        } catch (error) {
            console.error('Failed to fetch task detail:', error);
        } finally {
            setDetailLoading(false);
        }
    };

    const [viewStartDate, setViewStartDate] = useState<Date>(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    });

    const timelineRange = useMemo(() => {
        const start = new Date(viewStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end, days: 7 };
    }, [viewStartDate]);

    const navigateTimeline = (direction: 'prev' | 'next' | 'today') => {
        const newStart = new Date(viewStartDate);
        if (direction === 'today') {
            const d = new Date();
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            setViewStartDate(new Date(d.setDate(diff)));
        } else if (direction === 'next') {
            newStart.setDate(newStart.getDate() + 7);
            setViewStartDate(newStart);
        } else {
            newStart.setDate(newStart.getDate() - 7);
            setViewStartDate(newStart);
        }
    };

    const getStatusColor = (status: number) => {
        switch (status) {
            case 1: return '#94a3b8'; // Todo
            case 2: return '#0ea5e9'; // InProgress
            case 3: return '#a855f7'; // Submitted
            case 4: return '#ef4444'; // Missed
            case 5: return '#f59e0b'; // Adjusting
            case 6: return '#10b981'; // Completed
            default: return '#cbd5e1';
        }
    };

    const getPositionPercent = (dateStr: string | undefined | null) => {
        if (!timelineRange || !dateStr) return 0;
        const date = new Date(dateStr);
        const startTime = timelineRange.start.getTime();
        const endTime = timelineRange.end.getTime();
        const dateTime = date.getTime();
        
        const diff = dateTime - startTime;
        const total = endTime - startTime;
        const percent = (diff / total) * 100;
        return Math.min(Math.max(percent, -5), 105);
    };

    const renderRuler = () => {
        if (!timelineRange) return null;
        const days = [];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(timelineRange.start);
            date.setDate(date.getDate() + i);
            const isToday = date.toDateString() === new Date().toDateString();

            days.push(
                <div key={`day-${i}`} style={{ 
                    flex: 1, 
                    height: '45px', 
                    borderLeft: i === 0 ? 'none' : '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isToday ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                    borderBottom: '1px solid #f1f5f9',
                    minWidth: 0
                }}>
                    <span style={{ fontSize: '0.55rem', fontWeight: 800, color: isToday ? '#f59e0b' : '#94a3b8', textTransform: 'uppercase' }}>
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isToday ? '#f59e0b' : '#1e293b' }}>
                        {date.getDate()}
                    </span>
                </div>
            );
        }

        const startDate = new Date(timelineRange.start);
        const endDate = new Date(timelineRange.end);

        return (
            <div style={{ position: 'sticky', top: 0, left: 0, height: '80px', background: 'white', zIndex: 30, borderBottom: '1px solid #e2e8f0', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '35px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', padding: '0 1.5rem', fontSize: '0.7rem', fontWeight: 800, color: '#475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--primary-color)' }}>ACTIVE WEEK</span>
                        <span style={{ opacity: 0.5 }}>•</span>
                        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                            {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', width: '100%', height: '45px' }}>
                    {days}
                </div>
                {new Date() >= timelineRange.start && new Date() <= timelineRange.end && (
                    <div style={{ 
                        position: 'absolute', 
                        left: `${getPositionPercent(new Date().toISOString())}%`, 
                        top: 0, 
                        bottom: -2000, 
                        width: '2px', 
                        background: '#f59e0b', 
                        zIndex: 25,
                        opacity: 0.4,
                        pointerEvents: 'none'
                    }} />
                )}
            </div>
        );
    };

    const TaskRow = ({ task }: { task: TaskWithActivities }) => {
        const [isHovered, setIsHovered] = useState(false);
        if (!timelineRange) return null;
        
        const sortedLogs = [...(task.statusActivities || [])].sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        const getStatusFromAction = (action: string) => {
            const a = action.toLowerCase();
            if (a.includes('inprogress')) return 2;
            if (a.includes('submitted')) return 3;
            if (a.includes('missed')) return 4;
            if (a.includes('adjusting')) return 5;
            if (a.includes('completed')) return 6;
            if (a.includes('todo')) return 1;
            return 1;
        };

        const now = new Date();
        const timelineEnd = timelineRange.end;

        const transitions: { from: Date, to: Date, status: number }[] = [];
        let currentPos = new Date(task.startDate || (sortedLogs.length > 0 ? sortedLogs[0].createdAt : task.updatedDate || now));
        let currentStatus = 1; 

        sortedLogs.forEach((log) => {
            const logTime = new Date(log.createdAt);
            const nextStatus = getStatusFromAction(log.action);
            if (logTime > currentPos || nextStatus !== currentStatus) {
                transitions.push({ from: new Date(currentPos), to: new Date(logTime), status: currentStatus });
                currentPos = logTime;
                currentStatus = nextStatus;
            }
        });

        const actualEndDate = (task.status === 6) ? new Date(task.updatedDate || now) : now;
        const cappedEnd = actualEndDate > timelineEnd ? timelineEnd : actualEndDate;
        if (cappedEnd > currentPos) {
            transitions.push({ from: new Date(currentPos), to: new Date(cappedEnd), status: currentStatus });
        }

        return (
            <div style={{ display: 'flex', minHeight: '65px', alignItems: 'center', position: 'relative', width: '100%', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ position: 'relative', height: '100%', flex: 1, width: '100%' }}>
                    {task.startDate && (
                        <button 
                            onClick={() => handleTaskClick(task.taskId || (task as any).id)}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                            style={{ 
                                position: 'absolute', 
                                left: `${getPositionPercent(task.startDate)}%`, 
                                top: '8px', 
                                padding: '3px 10px',
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '7px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                zIndex: 10,
                                transform: 'translateX(-12px)',
                                cursor: 'pointer',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: isHovered ? '0 6px 14px rgba(0,0,0,0.06)' : '0 2px 4px rgba(0,0,0,0.03)',
                                borderColor: isHovered ? 'var(--primary-color)' : '#e2e8f0',
                                outline: 'none'
                            }}
                        >
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isHovered ? 'var(--primary-color)' : '#1e293b', whiteSpace: 'nowrap', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {task.name}
                            </span>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '5px' }}>
                                {(task as any).performerFullName || (task as any).assignedToFullName || 'U'}
                            </span>
                        </button>
                    )}

                    <div 
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        style={{ position: 'absolute', left: `${getPositionPercent(transitions[0]?.from.toISOString())}%`, width: `${getPositionPercent(cappedEnd.toISOString()) - getPositionPercent(transitions[0]?.from.toISOString())}%`, top: '34px', height: '22px', zIndex: 1, cursor: 'pointer' }}
                    />

                    {transitions.map((t, i) => {
                        const startPct = getPositionPercent(t.from.toISOString());
                        const endPct = getPositionPercent(t.to.toISOString());
                        const widthPct = endPct - startPct;
                        return (
                            <div key={i} style={{ position: 'absolute', left: `${startPct}%`, top: '40px', width: `${Math.max(widthPct, 0.5)}%`, height: '7px', background: getStatusColor(t.status), borderRadius: '4px', zIndex: 2, opacity: isHovered ? 1 : 0.85, filter: isHovered ? 'brightness(1.1)' : 'none', transition: 'all 0.2s ease', pointerEvents: 'none' }} />
                        );
                    })}

                    {task.startDate && new Date(task.startDate) >= timelineRange.start && new Date(task.startDate) <= timelineRange.end && (
                        <div style={{ position: 'absolute', left: `${getPositionPercent(task.startDate)}%`, top: '40px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', border: `3.5px solid #94a3b8`, transform: 'translate(-50%, -5px)', zIndex: 10, cursor: 'help', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} title={`Planned Start: ${new Date(task.startDate).toLocaleDateString()}`} />
                    )}

                    {sortedLogs.map((log) => {
                        const logDate = new Date(log.createdAt);
                        if (logDate < timelineRange.start || logDate > timelineRange.end) return null;
                        const posPct = getPositionPercent(log.createdAt);
                        const status = getStatusFromAction(log.action);
                        return (
                            <div key={log.id} style={{ position: 'absolute', left: `${posPct}%`, top: '40px', width: '12px', height: '12px', borderRadius: '50%', background: getStatusColor(status), transform: 'translate(-50%, -2.5px)', zIndex: 15, cursor: 'help', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} title={`${log.performedByFullName}: ${log.action}\nTime: ${new Date(log.createdAt).toLocaleString()}`} />
                        );
                    })}

                    {task.dueDate && new Date(task.dueDate) >= timelineRange.start && new Date(task.dueDate) <= timelineRange.end && (
                        <div style={{ position: 'absolute', left: `${getPositionPercent(task.dueDate)}%`, top: '40px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', border: `3.5px solid #ef4444`, transform: 'translate(-50%, -5px)', zIndex: 10, cursor: 'help', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={`Deadline: ${new Date(task.dueDate).toLocaleDateString()}`}>
                            <span style={{ fontSize: '9px', fontWeight: 900, color: '#ef4444' }}>!</span>
                        </div>
                    )}

                    {task.status === 6 && task.updatedDate && new Date(task.updatedDate) >= timelineRange.start && new Date(task.updatedDate) <= timelineRange.end && (
                        <div style={{ position: 'absolute', left: `${getPositionPercent(task.updatedDate)}%`, top: '40px', width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', border: '2px solid white', transform: 'translate(-50%, -3px)', zIndex: 11, cursor: 'help', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} title={`Completed on: ${new Date(task.updatedDate).toLocaleString()}`} />
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.02)', position: 'relative' }}>
            {/* Header / Toolbar */}
            <div style={{ padding: '0.8rem 1.2rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', zIndex: 40 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ padding: '6px', background: 'var(--primary-color)', color: 'white', borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Clock size={16} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>Timeline Table</h3>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '2px', borderRadius: '8px', width: 'fit-content' }}>
                            <button onClick={() => navigateTimeline('prev')} style={{ background: 'white', border: '1px solid #e2e8f0', padding: '3px 10px', fontSize: '0.65rem', fontWeight: 800, color: '#475569', cursor: 'pointer', borderRadius: '6px' }}>Prev Week</button>
                            <button onClick={() => navigateTimeline('today')} style={{ background: 'var(--primary-color)', border: 'none', padding: '3px 14px', fontSize: '0.65rem', fontWeight: 800, color: 'white', cursor: 'pointer', borderRadius: '6px' }}>Today</button>
                            <button onClick={() => navigateTimeline('next')} style={{ background: 'white', border: '1px solid #e2e8f0', padding: '3px 10px', fontSize: '0.65rem', fontWeight: 800, color: '#475569', cursor: 'pointer', borderRadius: '6px' }}>Next Week</button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {isSpecialRole && (
                                <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <button onClick={() => setTimelineMode('milestone')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', background: timelineMode === 'milestone' ? 'white' : 'transparent', color: timelineMode === 'milestone' ? 'var(--primary-color)' : '#64748b' }}>Overview</button>
                                    <button onClick={() => setTimelineMode('member')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', background: timelineMode === 'member' ? 'white' : 'transparent', color: timelineMode === 'member' ? 'var(--primary-color)' : '#64748b' }}>By Member</button>
                                </div>
                            )}
                            <select 
                                value={timelineMode === 'milestone' ? selectedMilestoneId : selectedMemberId} 
                                onChange={(e) => timelineMode === 'milestone' ? setSelectedMilestoneId(e.target.value) : setSelectedMemberId(e.target.value)} 
                                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.7rem', fontWeight: 700, background: 'white', minWidth: '180px' }}
                            >
                                {timelineMode === 'milestone' 
                                    ? milestones.map(m => (<option key={resolveMilestoneId(m)} value={resolveMilestoneId(m)}>{m.name || (m as any).title}</option>))
                                    : localMembers.map(m => (<option key={resolveMemberId(m)} value={resolveMemberId(m)}>{m.fullName || m.userName}</option>))
                                }
                            </select>
                        </div>

                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <button onClick={() => setViewMode('list')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', background: 'transparent' }}><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><List size={12} />List</div></button>
                            <button onClick={() => setViewMode('timeline')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', background: 'white', color: 'var(--primary-color)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} />Timeline</div></button>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', maxHeight: '700px' }} className="custom-scrollbar">
                {loading ? (
                    <div style={{ display: 'flex', height: '100%', minHeight: '300px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary-color)' }} />
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Syncing activities...</span>
                    </div>
                ) : activities.length > 0 ? (
                    <div style={{ width: '100%' }}>
                        {renderRuler()}
                        {activities.map(task => <TaskRow key={task.taskId || (task as any).id} task={task} />)}
                    </div>
                ) : (
                    <div style={{ display: 'flex', height: '100%', minHeight: '300px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: '#94a3b8' }}>
                        <Info size={48} strokeWidth={1} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, color: '#64748b' }}>No Activity Data</div>
                            <div style={{ fontSize: '0.75rem' }}>Try selecting a different milestone or member.</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', background: 'white', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {[{ label: 'Todo', color: getStatusColor(1) }, { label: 'In Progress', color: getStatusColor(2) }, { label: 'Submitted', color: getStatusColor(3) }, { label: 'Adjusting', color: getStatusColor(5) }, { label: 'Completed', color: getStatusColor(6) }, { label: 'Missed', color: getStatusColor(4) }].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '12px', height: '4px', background: item.color, borderRadius: '2px' }} />
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>{item.label}</span>
                    </div>
                ))}
            </div>

            {/* Modal Detail Note */}
            {selectedDetailTask && (
                <>
                    <div onClick={() => setSelectedDetailTask(null)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.05)', zIndex: 100, backdropFilter: 'blur(1px)' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '380px', maxHeight: '450px', background: 'white', borderRadius: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', zIndex: 101, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                        <div style={{ padding: '1.25rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.4 }}>{selectedDetailTask.details?.name}</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800 }}>{(selectedDetailTask.details?.member?.fullName || 'U')[0]}</div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{selectedDetailTask.details?.member?.fullName || 'Unassigned'}</span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedDetailTask(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>✕</button>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }} className="custom-scrollbar">
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Status Activity Log</div>
                            {selectedDetailTask.activities.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {[...selectedDetailTask.activities].reverse().map((log, index) => (
                                        <div key={log.id} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                                            {index !== selectedDetailTask.activities.length - 1 && (<div style={{ position: 'absolute', left: '7px', top: '22px', bottom: '-10px', width: '1px', background: '#f1f5f9' }} />)}
                                            <div style={{ width: '15px', height: '15px', borderRadius: '50%', background: getStatusColor(2), marginTop: '3px', flexShrink: 0, border: '3px solid white', boxShadow: '0 0 0 1px #f1f5f9' }} />
                                            <div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>{log.action}</div>
                                                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                                                    <span>{log.performedByFullName}</span> • <span>{new Date(log.createdAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (<div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.75rem' }}>No activity logs found.</div>)}
                        </div>
                        <div style={{ padding: '0.75rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setSelectedDetailTask(null)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#e2e8f0', color: '#475569', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Close Note</button>
                        </div>
                    </div>
                </>
            )}

            {detailLoading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'white', padding: '1rem 2rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Loader2 className="animate-spin" size={20} style={{ color: 'var(--primary-color)' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Opening Note...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityTimeline;
