import React, { useState, useRef, useEffect } from 'react';
import {
    Activity, Clock, Flag,
    Play, Send, AlertTriangle, ArrowUpRight,
    Layout, CheckCircle2, Target, ChevronRight
} from 'lucide-react';
import { Project, Milestone, Task, TaskStatus, MilestoneStatus, ProjectRoleEnum } from '@/types';
import { taskService } from '@/services';

interface DetailsHomeProps {
    project: Project;
    tasks: Task[];
    milestones: Milestone[];
    formatProjectDate: (date: string | Date | null | undefined, fallback?: string) => string;
    currentUser: any;
    currentMember: any;
    refreshData: () => void;
}

const DetailsHome: React.FC<DetailsHomeProps> = ({
    tasks, milestones, formatProjectDate, currentUser, currentMember, refreshData
}) => {
    const isManager = currentMember?.projectRole === ProjectRoleEnum.LabDirector || currentMember?.projectRole === ProjectRoleEnum.Leader;

    const [viewMode, setViewMode] = useState<'my-work' | 'perspective'>(isManager ? 'perspective' : 'my-work');
    const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('all');
    const [isMilestoneDropdownOpen, setIsMilestoneDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [submitting, setSubmitting] = useState<string | null>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsMilestoneDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

    // SCOPED DATA FILTERING
    const scopedTasks = selectedMilestoneId === 'all' 
        ? tasks 
        : tasks.filter(t => t.milestoneId === selectedMilestoneId);

    // Granular Metrics - Managers (Scoped)
    const managerMissedTasks = scopedTasks.filter(t => t.status !== TaskStatus.Submitted && t.status !== TaskStatus.Completed && t.dueDate && new Date(t.dueDate) < now);
    const managerWarningTasks = scopedTasks.filter(t => t.status !== TaskStatus.Submitted && t.status !== TaskStatus.Completed && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= threeDaysFromNow);
    const managerUnstartedTasks = scopedTasks.filter(t => t.status === TaskStatus.Todo && t.startDate && new Date(t.startDate) <= now);
    const managerPendingApproval = scopedTasks.filter(t => t.status === TaskStatus.Submitted);

    // Filtered Milestone logic
    const riskyMilestones = milestones.filter(m => {
        const isCurrent = m.status === MilestoneStatus.InProgress;
        const milestoneTasks = tasks.filter(t => t.milestoneId === m.milestoneId);
        const hasUnfinishedTasks = milestoneTasks.some(t => t.status !== TaskStatus.Completed);
        const isNearDeadline = m.dueDate && new Date(m.dueDate) <= threeDaysFromNow;
        return isCurrent && hasUnfinishedTasks && isNearDeadline;
    });

    // Granular Metrics - Practitioners (Scoped)
    const myMembershipId = currentMember?.membershipId || currentMember?.id;
    const projectMyTasks = scopedTasks.filter(t => t.memberId === myMembershipId || t.assignedToName === currentUser?.name);

    const myTasksInProgress = projectMyTasks.filter(t => [TaskStatus.Todo, TaskStatus.InProgress, TaskStatus.Adjusting].includes(t.status));
    const myAdjustingTasks = projectMyTasks.filter(t => t.status === TaskStatus.Adjusting);
    const myLateStartTasks = projectMyTasks.filter(t => t.status === TaskStatus.Todo && t.startDate && new Date(t.startDate) <= now);

    // Sorting Logic based on Role
    const getSortedTasks = () => {
        const priorityScoped = [...scopedTasks];
        return priorityScoped.sort((a, b) => {
            if (isManager) {
                // Manager Priorities: Risky Milestone > Missed > Warning > To Review
                const aInRisky = riskyMilestones.some(rm => rm.milestoneId === a.milestoneId);
                const bInRisky = riskyMilestones.some(rm => rm.milestoneId === b.milestoneId);
                if (aInRisky !== bInRisky) return aInRisky ? -1 : 1;

                const aMissed = a.status !== TaskStatus.Submitted && a.status !== TaskStatus.Completed && a.dueDate && new Date(a.dueDate) < now;
                const bMissed = b.status !== TaskStatus.Submitted && b.status !== TaskStatus.Completed && b.dueDate && new Date(b.dueDate) < now;
                if (aMissed !== bMissed) return aMissed ? -1 : 1;

                const aWarning = a.status !== TaskStatus.Submitted && a.status !== TaskStatus.Completed && a.dueDate && new Date(a.dueDate) >= now && new Date(a.dueDate) <= threeDaysFromNow;
                const bWarning = b.status !== TaskStatus.Submitted && b.status !== TaskStatus.Completed && b.dueDate && new Date(b.dueDate) >= now && new Date(b.dueDate) <= threeDaysFromNow;
                if (aWarning !== bWarning) return aWarning ? -1 : 1;

                const aReview = a.status === TaskStatus.Submitted;
                const bReview = b.status === TaskStatus.Submitted;
                if (aReview !== bReview) return aReview ? -1 : 1;
            } else {
                // Researcher Priorities: High Priority (Late Start) > Needs Adjusting > Unstarted (Todo)
                const aLate = a.status === TaskStatus.Todo && a.startDate && new Date(a.startDate) <= now;
                const bLate = b.status === TaskStatus.Todo && b.startDate && new Date(b.startDate) <= now;
                if (aLate !== bLate) return aLate ? -1 : 1;

                const aAdj = a.status === TaskStatus.Adjusting;
                const bAdj = b.status === TaskStatus.Adjusting;
                if (aAdj !== bAdj) return aAdj ? -1 : 1;

                const aTodo = a.status === TaskStatus.Todo;
                const bTodo = b.status === TaskStatus.Todo;
                if (aTodo !== bTodo) return aTodo ? -1 : 1;
            }
            return 0;
        });
    };

    const sortedTasks = getSortedTasks();

    // Handlers
    const handleStartTask = async (taskId: string) => {
        setSubmitting(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.InProgress);
            refreshData();
        } catch (error) {
            console.error('Failed to start task:', error);
        } finally {
            setSubmitting(null);
        }
    };

    // Helper Component for Status Rows
    const StatusRow = ({ icon, label, count, color, tooltip, pulse = false }: { icon: any, label: string, count: number, color: string, tooltip: string, pulse?: boolean }) => (
        <div 
            title={tooltip}
            style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0',
                opacity: count > 0 ? 1 : 0.45,
                transition: 'all 0.2s',
                cursor: 'help'
            }}>
            <div className={pulse ? (color === '#ef4444' ? 'pulse-red' : 'pulse-orange') : ''} style={{
                width: '24px', height: '24px', borderRadius: '6px', background: color, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
                {React.cloneElement(icon, { size: 14 })}
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>{label}:</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: count > 0 ? '#1e293b' : '#94a3b8' }}>{count}</span>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>

            {/* CSS for animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse-red {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
                @keyframes pulse-orange {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
                    70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
                .pulse-red { animation: pulse-red 2s infinite; }
                .pulse-orange { animation: pulse-orange 2s infinite; }
                .hover-lift:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .roadmap-scroll::-webkit-scrollbar {
                    display: none;
                }
                .filter-pill {
                    padding: 6px 14px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    color: #64748b;
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                }
                .filter-pill.active {
                    background: var(--primary-color);
                    border-color: var(--primary-color);
                    color: white;
                    box-shadow: 0 4px 10px rgba(232, 114, 12, 0.2);
                }
                .filter-pill:hover:not(.active) {
                    border-color: var(--primary-color);
                    color: var(--primary-color);
                    background: #fffaf5;
                }
            `}</style>

            {/* VIEW TOGGLE & UNIFIED STATUS BOARD */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => setViewMode('my-work')}
                            style={{
                                padding: '8px 16px', borderRadius: '10px', border: 'none',
                                background: viewMode === 'my-work' ? 'white' : 'transparent',
                                color: viewMode === 'my-work' ? 'var(--primary-color)' : '#64748b',
                                boxShadow: viewMode === 'my-work' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.2s'
                            }}
                        >
                            My Work
                        </button>
                        <button
                            onClick={() => setViewMode('perspective')}
                            style={{
                                padding: '8px 16px', borderRadius: '10px', border: 'none',
                                background: viewMode === 'perspective' ? 'white' : 'transparent',
                                color: viewMode === 'perspective' ? 'var(--primary-color)' : '#64748b',
                                boxShadow: viewMode === 'perspective' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.2s'
                            }}
                        >
                            Project Overview
                        </button>
                    </div>

                    {/* PREMIUM CUSTOM MILESTONE DROPDOWN */}
                    <div ref={dropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsMilestoneDropdownOpen(!isMilestoneDropdownOpen)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 16px', borderRadius: '12px',
                                border: '1px solid #e2e8f0', background: 'white',
                                color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 800,
                                cursor: 'pointer', transition: 'all 0.2s',
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                boxShadow: isMilestoneDropdownOpen ? '0 0 0 3px rgba(232,114,12,0.1)' : '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                        >
                            {selectedMilestoneId === 'all' 
                                ? 'Entire Project' 
                                : milestones.find(m => String(m.milestoneId) === String(selectedMilestoneId))?.name || 'Milestone'}
                            <ChevronRight 
                                size={14} 
                                style={{ 
                                    transform: isMilestoneDropdownOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease'
                                }} 
                            />
                        </button>

                        {isMilestoneDropdownOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                                background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '220px', zIndex: 100,
                                padding: '6px', animation: 'fadeIn 0.2s ease-out',
                                maxHeight: '300px', overflowY: 'auto'
                            }}>
                                <div 
                                    onClick={() => { setSelectedMilestoneId('all'); setIsMilestoneDropdownOpen(false); }}
                                    style={{
                                        padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
                                        color: selectedMilestoneId === 'all' ? 'var(--primary-color)' : '#475569',
                                        background: selectedMilestoneId === 'all' ? '#fffaf5' : 'transparent',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                    className="dropdown-item"
                                >
                                    Entire Project
                                </div>
                                {milestones.map(m => (
                                    <div 
                                        key={m.milestoneId}
                                        onClick={() => { setSelectedMilestoneId(m.milestoneId); setIsMilestoneDropdownOpen(false); }}
                                        style={{
                                            padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600,
                                            color: selectedMilestoneId === m.milestoneId ? 'var(--primary-color)' : '#475569',
                                            background: selectedMilestoneId === m.milestoneId ? '#fffaf5' : 'transparent',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                        className="dropdown-item"
                                    >
                                        {m.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* UNIFIED STATUS BOARD */}
                <div style={{ 
                    background: 'white', padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0',
                    display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1.5rem', alignItems: 'start',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)', position: 'relative'
                }}>
                    {/* SCOPE BADGE */}
                    <div style={{ 
                        position: 'absolute', top: '-10px', right: '20px', 
                        background: '#fffaf5', padding: '4px 12px', borderRadius: '20px', border: '1px solid #fed7aa',
                        fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em',
                        display: 'flex', alignItems: 'center', gap: '6px', zIndex: 1,
                        boxShadow: '0 2px 8px rgba(232, 114, 12, 0.1)'
                    }}>
                        <Target size={10} color="var(--primary-color)" /> 
                        {selectedMilestoneId === 'all' 
                            ? 'Entire Project' 
                            : milestones.find(m => String(m.milestoneId) === String(selectedMilestoneId))?.name || 'Milestone'}
                    </div>

                    {/* CỘT TRÁI: CRITICAL ALERTS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {viewMode === 'perspective' ? 'Critical Alerts (Project)' : 'Action Required (Tasks)'}
                        </h4>
                        {viewMode === 'perspective' ? (
                            <>
                                <StatusRow icon={<AlertTriangle />} label="Missed Tasks" count={managerMissedTasks.length} color="#ef4444" tooltip="Project-wide: Tasks past deadline and not yet submitted." pulse={managerMissedTasks.length > 0} />
                                <StatusRow icon={<Clock />} label="Warnings" count={managerWarningTasks.length} color="#f59e0b" tooltip="Project-wide: Deadlines approaching in less than 3 days." pulse={managerWarningTasks.length > 0} />
                                <StatusRow icon={<Play />} label="Unstarted" count={managerUnstartedTasks.length} color="#0ea5e9" tooltip="Project-wide: StartTime passed but work hasn't begun." pulse={managerUnstartedTasks.length > 0} />
                                <StatusRow icon={<Target />} label="Risky Milestones" count={riskyMilestones.length} color="#b91c1c" tooltip="Milestones near deadline with unfinished tasks." pulse={riskyMilestones.length > 0} />
                            </>
                        ) : (
                            <>
                                <StatusRow icon={<Play />} label="High Priority" count={myLateStartTasks.length} color="#ef4444" tooltip="Your tasks that should have started by today." pulse={myLateStartTasks.length > 0} />
                                <StatusRow icon={<AlertTriangle />} label="Needs Adjusting" count={myAdjustingTasks.length} color="#f59e0b" tooltip="Your tasks specifically flagged for adjustment." pulse={myAdjustingTasks.length > 0} />
                            </>
                        )}
                    </div>

                    {/* DIVIDER */}
                    <div style={{ width: '1px', alignSelf: 'stretch', background: '#f1f5f9' }}></div>

                    {/* CỘT PHẢI: PROGRESS INDICATORS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {viewMode === 'perspective' ? 'Project Metrics (Total)' : 'Your Progress Status'}
                        </h4>
                        {viewMode === 'perspective' ? (
                            <>
                                <StatusRow icon={<Send />} label="To Review" count={managerPendingApproval.length} color="#8b5cf6" tooltip="Tasks submitted and waiting for your approval." />
                                <StatusRow icon={<Activity />} label="In Progress" count={tasks.filter(t => t.status === TaskStatus.InProgress).length} color="#3b82f6" tooltip="Total tasks currently being worked on by the team." />
                                <StatusRow icon={<CheckCircle2 />} label="Completed" count={tasks.filter(t => t.status === TaskStatus.Completed).length} color="#22c55e" tooltip="Total tasks fully finished and approved." />
                                <StatusRow icon={<Layout />} label="Total Tasks" count={tasks.length} color="#94a3b8" tooltip="Total number of tasks defined in this project." />
                            </>
                        ) : (
                            <>
                                <StatusRow icon={<Activity />} label="Tasks Remaining" count={myTasksInProgress.length} color="#0ea5e9" tooltip="Your current active workload (Across all milestones)." />
                                <StatusRow icon={<CheckCircle2 />} label="My Completed" count={tasks.filter(t => (t.memberId === myMembershipId || t.assignedToName === currentUser?.name) && t.status === TaskStatus.Completed).length} color="#22c55e" tooltip="Tasks you have successfully completed in this project." />
                                <StatusRow icon={<Layout />} label="Total Assigned" count={projectMyTasks.length} color="#94a3b8" tooltip="Total tasks assigned to you in this project." />
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* TẦNG 2: Action Items */}
            <section style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {viewMode === 'my-work' ? (
                                <><Activity size={20} style={{ color: 'var(--primary-color)' }} /> Your Tasks</>
                            ) : (
                                <><Layout size={20} style={{ color: 'var(--primary-color)' }} /> High Priority Focus</>
                            )}
                        </h3>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)', opacity: 0.8 }}>
                            / {selectedMilestoneId === 'all' 
                                ? 'Entire Project' 
                                : milestones.find(m => String(m.milestoneId) === String(selectedMilestoneId))?.name || 'Milestone'}
                        </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', background: '#f8fafc', padding: '4px 12px', borderRadius: '20px', border: '1px solid #f1f5f9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {viewMode === 'my-work' ? `${myTasksInProgress.length} tasks` : `${scopedTasks.length} tasks`}
                    </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(viewMode === 'my-work' ? sortedTasks.filter(t => (t.memberId === myMembershipId || t.assignedToName === currentUser?.name) && [TaskStatus.Todo, TaskStatus.InProgress, TaskStatus.Adjusting].includes(t.status)) : sortedTasks.slice(0, 10)).map(task => (
                        <div key={task.taskId} style={{
                            padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9',
                            display: 'flex', alignItems: 'center', gap: '1.5rem', transition: 'all 0.2s'
                        }} className="hover-lift">
                            <div style={{ padding: '8px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', color: 'var(--primary-color)' }}>
                                <CheckCircle2 size={20} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{task.name}</h4>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} /> {task.dueDate ? formatProjectDate(task.dueDate) : 'No deadline'}
                                    </span>
                                    <span style={{
                                        fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                                        color: task.status === TaskStatus.Todo ? '#64748b' :
                                            task.status === TaskStatus.InProgress ? '#0ea5e9' :
                                                task.status === TaskStatus.Adjusting ? '#f59e0b' : '#ef4444'
                                    }}>
                                        {TaskStatus[task.status]}
                                    </span>
                                </div>
                            </div>

                            {/* QUICK ACTIONS */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {task.status === TaskStatus.Todo && (
                                    <button
                                        disabled={submitting === task.taskId}
                                        onClick={() => handleStartTask(task.taskId)}
                                        style={{
                                            padding: '8px 16px', borderRadius: '10px', background: 'var(--primary-color)', color: 'white',
                                            border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px', opacity: submitting === task.taskId ? 0.7 : 1
                                        }}
                                    >
                                        <Play size={16} fill="white" /> Start Task
                                    </button>
                                )}
                                {(task.status === TaskStatus.InProgress || task.status === TaskStatus.Adjusting) && (
                                    <button style={{
                                        padding: '8px 16px', borderRadius: '10px', background: '#f0fdf4', color: '#16a34a',
                                        border: '1px solid #bbf7d0', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}>
                                        <Send size={16} /> Submit Work
                                    </button>
                                )}
                                <button style={{
                                    width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: 'pointer'
                                }}>
                                    <ArrowUpRight size={18} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {(viewMode === 'my-work' ? myTasksInProgress : tasks).length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            <Activity size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p style={{ margin: 0, fontWeight: 600 }}>No tasks currently in your focus stream.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* CSS for animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .hover-lift {
                    transition: all 0.2s ease-out;
                }
                .hover-lift:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    border-color: var(--primary-color) !important;
                }
                .roadmap-scroll::-webkit-scrollbar {
                    display: none;
                }
            `}</style>

            {/* TẦNG 3: NGỮ CẢNH VÀ ĐƯỜNG ĐI TIẾP THEO */}
            <section style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project Roadmap</h3>
                </div>

                <div
                    className="roadmap-scroll"
                    style={{
                        display: 'flex',
                        gap: '1.5rem',
                        overflowX: 'auto',
                        paddingBottom: '1.5rem',
                        paddingLeft: '4px',
                        scrollSnapType: 'x mandatory'
                    }}
                >
                    {milestones.length > 0 ? milestones.map((m, idx) => {
                        const isPast = m.status === MilestoneStatus.Completed;
                        const isCurrent = m.status === MilestoneStatus.InProgress;

                        // Milestone Risk Logic: Near deadline but has unfinished tasks
                        const milestoneTasks = tasks.filter(t => t.milestoneId === m.milestoneId);
                        const hasUnfinishedTasks = milestoneTasks.some(t => t.status !== TaskStatus.Completed);
                        const isNearDeadline = m.dueDate && new Date(m.dueDate) <= threeDaysFromNow;
                        const isRisky = isCurrent && hasUnfinishedTasks && isNearDeadline;

                        return (
                            <div key={`ms-${m.milestoneId || idx}`} style={{
                                minWidth: '300px', flex: '0 0 300px', padding: '1.5rem', background: 'white',
                                borderRadius: '24px', border: `2px solid ${isRisky ? '#ef4444' : isCurrent ? 'var(--primary-color)' : '#e2e8f0'}`,
                                position: 'relative', scrollSnapAlign: 'start',
                                boxShadow: isRisky ? '0 12px 30px rgba(239, 68, 68, 0.1)' : isCurrent ? '0 12px 30px rgba(232, 114, 12, 0.12)' : 'none',
                                opacity: isPast ? 0.8 : 1
                            }}>
                                {idx < milestones.length - 1 && (
                                    <div style={{
                                        position: 'absolute', top: '50%', right: '-32px', transform: 'translateY(-50%)',
                                        color: isPast ? 'var(--primary-color)' : '#e2e8f0', zIndex: 1
                                    }}>
                                        <ChevronRight size={32} strokeWidth={isPast ? 3 : 2} />
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '12px',
                                        background: isPast ? '#f0fdf4' : isRisky ? '#fef2f2' : isCurrent ? '#fff7ed' : '#f8fafc',
                                        color: isPast ? '#16a34a' : isRisky ? '#ef4444' : isCurrent ? '#ea580c' : '#94a3b8',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: isRisky ? '1px solid #fee2e2' : isCurrent ? '1px solid #ffedd5' : 'none'
                                    }}>
                                        <Target size={22} />
                                    </div>
                                    <span style={{
                                        fontSize: '0.7rem', fontWeight: 800, padding: '4px 12px', borderRadius: '12px',
                                        background: isPast ? '#dcfce7' : isRisky ? '#fee2e2' : isCurrent ? '#ffedd5' : '#f1f5f9',
                                        color: isPast ? '#166534' : isRisky ? '#991b1b' : isCurrent ? '#9a3412' : '#64748b',
                                        border: isRisky ? '1px solid #fecaca' : isCurrent ? '1px solid #fed7aa' : 'none'
                                    }}>
                                        {isPast ? 'DONE' : isRisky ? 'HIGH RISK' : isCurrent ? 'ACTIVE' : 'UPCOMING'}
                                    </span>
                                </div>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{m.name}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                                    <Clock size={14} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        {m.dueDate ? formatProjectDate(m.dueDate) : 'No due date'}
                                    </span>
                                </div>

                                {isCurrent && (
                                    <div style={{ marginTop: '1.25rem', height: '6px', width: '100%', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${m.progress || 35}%`, background: 'var(--primary-color)', borderRadius: '3px' }}></div>
                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                        <div style={{ textAlign: 'center', width: '100%', padding: '3rem', color: 'var(--text-secondary)', background: '#f8fafc', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                            <Flag size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                            <p style={{ margin: 0, fontWeight: 700 }}>Your project roadmap will appear here.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default DetailsHome;
