import React, { useState, useRef, useEffect } from 'react';
import {
    Activity, Clock, Calendar, User, Users,
    Play, Send, AlertTriangle,
    Layout, CheckCircle2, Target, ChevronRight, ChevronDown, Loader2
} from 'lucide-react';
import { Project, Milestone, Task, TaskStatus, MilestoneStatus, ProjectRoleEnum } from '@/types';
import { taskService, dashboardService } from '@/services';

interface DetailsHomeProps {
    project: Project;
    tasks: Task[];
    milestones: Milestone[];
    timelineData: any;
    members: any[];
    formatProjectDate: (date: string | Date | null | undefined, fallback?: string) => string;
    currentUser: any;
    currentMember: any;
    refreshData: () => void;
}

const getStatusText = (status: number) => {
    switch (status) {
        case 1: return 'To Do';
        case 2: return 'In Progress';
        case 3: return 'Submitted';
        case 4: return 'Missed';
        case 5: return 'Adjusting';
        case 6: return 'Done';
        default: return 'Unknown';
    }
};

const getStatusColor = (status: number) => {
    switch (status) {
        case 1: return { bg: '#f1f5f9', text: '#64748b' };
        case 2: return { bg: '#eff6ff', text: '#3b82f6' };
        case 3: return { bg: '#ecfdf5', text: '#10b981' };
        case 4: return { bg: '#fef2f2', text: '#ef4444' };
        case 5: return { bg: '#fff7ed', text: '#f97316' };
        case 6: return { bg: '#f0fdf4', text: '#22c55e' };
        default: return { bg: '#f1f5f9', text: '#64748b' };
    }
};

const DetailsHome: React.FC<DetailsHomeProps> = ({
    project, tasks, milestones, timelineData, members, formatProjectDate, currentUser, currentMember, refreshData
}) => {
    const isManager = currentMember?.projectRole === ProjectRoleEnum.LabDirector || currentMember?.projectRole === ProjectRoleEnum.Leader;
    const myMembershipId = currentMember?.membershipId || currentMember?.id || (currentMember as any)?.memberId;

    const [viewMode, setViewMode] = useState<'my-work' | 'perspective'>(isManager ? 'perspective' : 'my-work');
    const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
    const [isMilestoneDropdownOpen, setIsMilestoneDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [expandedTasks, setExpandedTasks] = useState<string[]>([]);

    // API Stats State
    const [overviewStats, setOverviewStats] = useState<any>(null);
    const [myWorkStats, setMyWorkStats] = useState<any>(null);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [myWorkTasks, setMyWorkTasks] = useState<Task[]>([]);
    const [_loadingStats, setLoadingStats] = useState(false);

    // Fetch Dashboard Stats from API
    const fetchDashboardStats = React.useCallback(async () => {
        const memberId = currentMember?.membershipId || currentMember?.id || (currentMember as any)?.memberId;
        const pId = project?.projectId || (project as any)?.id;

        if (!pId) return;

        setLoadingStats(true);
        try {
            const mId = selectedMilestoneId === 'all' ? '' : selectedMilestoneId;
            const [overview, myWork] = await Promise.all([
                dashboardService.getOverview(mId),
                memberId ? dashboardService.getMyWork(memberId, mId) : Promise.resolve(null)
            ]);

            setOverviewStats(overview);
            setMyWorkStats(myWork);
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error);
        } finally {
            setLoadingStats(false);
        }
    }, [selectedMilestoneId, currentMember]);

    const fetchMyTasks = React.useCallback(async () => {
        setLoadingTasks(true);
        try {
            const allMyTasks = await taskService.getPriorityTasks();
            const pId = project.projectId || (project as any).id;
            // Filter global priority tasks to only those belonging to THIS project
            const filteredByProject = allMyTasks.filter((t: any) => (t.projectId || t.project?.id) === pId);
            setMyWorkTasks(filteredByProject);
        } catch (err) {
            console.error('Failed to fetch personal tasks:', err);
        } finally {
            setLoadingTasks(false);
        }
    }, [project.projectId]);

    useEffect(() => {
        const pId = project?.projectId || (project as any).id;
        if (pId) {
            fetchDashboardStats();
            if (viewMode === 'my-work') {
                fetchMyTasks();
            }
        }
    }, [fetchDashboardStats, fetchMyTasks, project, selectedMilestoneId, viewMode]);

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

    // Resolve ID consistently
    const getMId = (m: any) => m.milestoneId || m.id;

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

    // SCOPED DATA FILTERING (For list display)
    const scopedTasks = !selectedMilestoneId || selectedMilestoneId === 'all'
        ? tasks
        : tasks.filter(t => String(t.milestoneId || "") === String(selectedMilestoneId));

    // Fix Milestone Duplication & Filter
    const uniqueMilestones = React.useMemo(() => {
        const seen = new Set();
        return milestones.filter((m, idx) => {
            const id = getMId(m) || `temp-${m.name}-${idx}`;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }, [milestones]);

    // Fallback Metrics Logic (Keep as backup if API doesn't return everything)
    const getManagerMetrics = () => {
        if (overviewStats) return {
            missed: overviewStats.missedTasks ?? 0,
            warning: overviewStats.warmingTasks ?? overviewStats.warningTasks ?? 0,
            unstarted: overviewStats.unstartedTasks ?? 0,
            waiting: overviewStats.waitingTasks ?? 0,
            pendingApproval: overviewStats.toReviewTasks ?? overviewStats.pendingApproval ?? 0,
            risky: overviewStats.riskyMilestone ?? overviewStats.riskyMilestones ?? 0,
            running: overviewStats.runningTasks ?? 0,
            completed: overviewStats.completedTasks ?? 0,
            total: overviewStats.totalTasks ?? scopedTasks.length
        };

        // FE-only fallback
        return {
            missed: scopedTasks.filter(t => t.status !== TaskStatus.Submitted && t.status !== TaskStatus.Completed && t.dueDate && new Date(t.dueDate) < now).length,
            warning: scopedTasks.filter(t => t.status !== TaskStatus.Submitted && t.status !== TaskStatus.Completed && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= threeDaysFromNow).length,
            unstarted: scopedTasks.filter(t => t.status === TaskStatus.Todo && t.startDate && new Date(t.startDate) <= now).length,
            waiting: scopedTasks.filter(t => t.status === TaskStatus.Todo).length,
            pendingApproval: scopedTasks.filter(t => t.status === TaskStatus.Submitted).length,
            risky: uniqueMilestones.filter(m => {
                const isC = m.status === MilestoneStatus.InProgress;
                const mId = getMId(m);
                const hasU = tasks.filter(t => String(t.milestoneId || "") === String(mId)).some(t => t.status !== TaskStatus.Completed);
                const isN = m.dueDate && new Date(m.dueDate) <= threeDaysFromNow;
                return isC && hasU && isN;
            }).length,
            running: scopedTasks.filter(t => t.status === TaskStatus.InProgress).length,
            completed: scopedTasks.filter(t => t.status === TaskStatus.Completed).length,
            total: scopedTasks.length
        };
    };

    const getMyWorkMetrics = () => {
        if (myWorkStats) return {
            highPriority: myWorkStats.highPriority ?? myWorkStats.lateStartTasks ?? 0,
            adjusting: myWorkStats.needsAdjusting ?? myWorkStats.adjustingTasks ?? 0,
            waiting: myWorkStats.waiting ?? myWorkStats.waitingTasks ?? 0,
            missed: myWorkStats.missedTasks ?? 0,
            running: myWorkStats.running ?? myWorkStats.runningTasks ?? 0,
            completed: myWorkStats.completed ?? myWorkStats.completedTasks ?? 0,
            assigned: myWorkStats.assigned ?? myWorkStats.assignedTasks ?? 0
        };

        const myMembershipId = currentMember?.membershipId || currentMember?.id;
        const projectMyTasks = scopedTasks.filter((t: Task) => t.memberId === myMembershipId || t.assignedToName === currentUser?.name);

        return {
            highPriority: projectMyTasks.filter(t => t.status === TaskStatus.Todo && t.startDate && new Date(t.startDate) <= now).length,
            adjusting: projectMyTasks.filter(t => t.status === TaskStatus.Adjusting).length,
            waiting: projectMyTasks.filter(t => t.status === TaskStatus.Todo).length,
            missed: projectMyTasks.filter(t => t.status !== TaskStatus.Submitted && t.status !== TaskStatus.Completed && t.dueDate && new Date(t.dueDate) < now).length,
            running: projectMyTasks.filter(t => [TaskStatus.Todo, TaskStatus.InProgress, TaskStatus.Adjusting].includes(t.status)).length,
            completed: projectMyTasks.filter(t => t.status === TaskStatus.Completed).length,
            assigned: projectMyTasks.length
        };
    };

    const managerStats = getManagerMetrics();
    const practitionerStats = getMyWorkMetrics();

    // Auto-select nearest active milestone
    useEffect(() => {
        // Only auto-select if we have milestones and haven't selected one yet (or it's the 'all' legacy state)
        if (uniqueMilestones.length > 0 && (!selectedMilestoneId || selectedMilestoneId === 'all')) {
            const prioritizedMilestones = uniqueMilestones
                .filter(m => m.status === MilestoneStatus.InProgress || m.status === MilestoneStatus.Completed)
                .sort((a, b) => {
                    const dateA = new Date(a.dueDate).getTime();
                    const dateB = new Date(b.dueDate).getTime();
                    return dateA - dateB;
                });

            if (prioritizedMilestones.length > 0) {
                const targetId = getMId(prioritizedMilestones[0]);
                if (targetId) setSelectedMilestoneId(targetId);
            } else {
                const targetId = getMId(uniqueMilestones[0]);
                if (targetId) setSelectedMilestoneId(targetId);
            }
        }
    }, [uniqueMilestones, selectedMilestoneId]);

    // Handlers
    const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
        // Ownership check
        const targetTask = tasks.find(t => (t as any).id === taskId || t.taskId === taskId);
        const taskOwnerId = targetTask?.memberId || (targetTask as any).assignedToId;

        if (taskOwnerId !== myMembershipId) {
            console.warn('Unauthorized task update attempt.');
            return;
        }

        setSubmitting(taskId);
        try {
            await taskService.updateStatus(taskId, newStatus);
            refreshData(); // Triggers parent refetch
            fetchDashboardStats(); // Explicitly refresh stats here too
        } catch (error) {
            console.error('Failed to update task status:', error);
        } finally {
            setSubmitting(null);
        }
    };

    const toggleTaskExpand = (taskId: string) => {
        setExpandedTasks(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
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

    const myTasksInProgressCount = scopedTasks.filter(t => (t.memberId === myMembershipId || t.assignedToName === currentUser?.name) && [TaskStatus.Todo, TaskStatus.InProgress, TaskStatus.Adjusting].includes(t.status)).length;

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
                .animate-spin {
                    animation: rotate 1s linear infinite;
                }

                .animate-spin-slow {
                    animation: rotate 2s linear infinite;
                }

                @keyframes rotate {
                    100% { transform: rotate(360deg); }
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
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
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
                            {uniqueMilestones.find(m => String(getMId(m)) === String(selectedMilestoneId))?.name || 'Milestone'}
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
                                {uniqueMilestones.map((m, idx) => {
                                    const mId = getMId(m) || `idx-${idx}`;
                                    return (
                                        <div
                                            key={mId}
                                            onClick={() => { setSelectedMilestoneId(String(mId)); setIsMilestoneDropdownOpen(false); }}
                                            style={{
                                                padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600,
                                                color: String(selectedMilestoneId) === String(mId) ? 'var(--primary-color)' : '#475569',
                                                background: String(selectedMilestoneId) === String(mId) ? '#fffaf5' : 'transparent',
                                                cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                            className="dropdown-item"
                                        >
                                            {m.name}
                                        </div>
                                    );
                                })}
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

                    {/* CỘT TRÁI: CRITICAL ALERTS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {viewMode === 'perspective' ? 'Critical Alerts' : 'Action Required'}
                        </h4>
                        {viewMode === 'perspective' ? (
                            <>
                                <StatusRow icon={<AlertTriangle />} label="Missed Tasks" count={managerStats.missed} color="#ef4444" tooltip="Current Milestone: Tasks past deadline and not yet submitted." pulse={managerStats.missed > 0} />
                                <StatusRow icon={<Clock />} label="Warnings" count={managerStats.warning} color="#f59e0b" tooltip="Current Milestone: Deadlines approaching in less than 3 days." pulse={managerStats.warning > 0} />
                                <StatusRow icon={<Play />} label="Unstarted" count={managerStats.unstarted} color="#0ea5e9" tooltip="Current Milestone: Scheduled start time has passed." pulse={managerStats.unstarted > 0} />
                                <StatusRow icon={<Target />} label="Risky Milestones" count={managerStats.risky} color="#b91c1c" tooltip="Milestone is near deadline with unfinished tasks." pulse={managerStats.risky > 0} />
                            </>
                        ) : (
                            <>
                                <StatusRow icon={<AlertTriangle />} label="Missed Tasks" count={practitionerStats.missed} color="#ef4444" tooltip="In this milestone: Your tasks past deadline and not yet submitted." pulse={practitionerStats.missed > 0} />
                                <StatusRow icon={<Play />} label="High Priority" count={practitionerStats.highPriority} color="#f59e0b" tooltip="In this milestone: Your tasks that should have started by today." pulse={practitionerStats.highPriority > 0} />
                                <StatusRow icon={<AlertTriangle />} label="Needs Adjusting" count={practitionerStats.adjusting} color="#ea580c" tooltip="In this milestone: Your tasks specifically flagged for adjustment." pulse={practitionerStats.adjusting > 0} />
                            </>
                        )}
                    </div>

                    {/* DIVIDER */}
                    <div style={{ width: '1px', alignSelf: 'stretch', background: '#f1f5f9' }}></div>

                    {/* CỘT PHẢI: PROGRESS INDICATORS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {viewMode === 'perspective' ? 'Milestone Metrics' : 'Milestone Progress'}
                        </h4>
                        {viewMode === 'perspective' ? (
                            <>
                                <StatusRow icon={<Send />} label="To Review" count={managerStats.pendingApproval} color="#8b5cf6" tooltip="In this milestone: Tasks submitted and waiting for your approval." />
                                <StatusRow icon={<Target />} label="Waiting" count={managerStats.waiting} color="#64748b" tooltip="In this milestone: Tasks currently in To Do or Adjustment state." />
                                <StatusRow icon={<Activity />} label="Running" count={managerStats.running} color="#3b82f6" tooltip="In this milestone: Tasks currently being worked on by the team." />
                                <StatusRow icon={<CheckCircle2 />} label="Completed" count={managerStats.completed} color="#22c55e" tooltip="In this milestone: Tasks fully finished and approved." />
                                <StatusRow icon={<Layout />} label="Total Tasks" count={managerStats.total} color="#94a3b8" tooltip="Total number of tasks defined in this milestone." />
                            </>
                        ) : (
                            <>
                                <StatusRow icon={<CheckCircle2 />} label="Completed" count={practitionerStats.completed} color="#22c55e" tooltip="Your completed tasks in this milestone." />
                                <StatusRow icon={<Activity />} label="In Progress" count={practitionerStats.running} color="#3b82f6" tooltip="Your tasks currently being worked on." />
                                <StatusRow icon={<Clock />} label="Waiting" count={practitionerStats.waiting} color="#64748b" tooltip="Your tasks assigned but not yet started." />
                                <StatusRow icon={<Target />} label="Total Assigned" count={practitionerStats.assigned} color="#94a3b8" tooltip="Total number of tasks assigned to you in this milestone." />
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* TẦNG 2 & 3: Consolidated Task Execution Overview */}
            <section style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {viewMode === 'my-work' ? (
                                <><Activity size={20} style={{ color: 'var(--primary-color)' }} /> My Tasks</>
                            ) : (
                                <><Layout size={20} style={{ color: 'var(--primary-color)' }} /> Milestone Tasks</>
                            )}
                        </h3>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)', opacity: 0.8 }}>
                            / {selectedMilestoneId === 'all' || !selectedMilestoneId
                                ? 'Entire Project'
                                : milestones.find(m => String(m.milestoneId || (m as any).id) === String(selectedMilestoneId))?.name || 'Milestone'}
                        </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', background: '#f8fafc', padding: '4px 12px', borderRadius: '20px', border: '1px solid #f1f5f9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {viewMode === 'my-work' ? `${myTasksInProgressCount} focus tasks` : `${scopedTasks.length} total tasks`}
                    </span>
                </div>

                {(() => {
                    // Extract all tasks from the hierarchical response structure
                    let sourceTasks = tasks || [];
                    if (timelineData) {
                        const tieredTasks: any[] = [];

                        // 1. Tasks from milestones
                        if (timelineData.milestones) {
                            timelineData.milestones.forEach((m: any) => {
                                const mId = m.milestone?.id || m.milestone?.milestoneId || (m as any).id;
                                (m.tasks || m.milestoneTasks || []).forEach((t: any) => {
                                    tieredTasks.push({ ...t, milestoneId: t.milestoneId || mId });
                                });
                            });
                        } else if (Array.isArray(timelineData) && timelineData.length > 0) {
                            // Array fallback
                            timelineData.forEach((m: any) => {
                                const mId = m.milestone?.id || m.milestone?.milestoneId || (m as any).id;
                                (m.tasks || m.milestoneTasks || []).forEach((t: any) => {
                                    tieredTasks.push({ ...t, milestoneId: t.milestoneId || mId });
                                });
                            });
                        }

                        // 2. General tasks (not linked to milestones)
                        if (timelineData.generalTasks && Array.isArray(timelineData.generalTasks)) {
                            timelineData.generalTasks.forEach((t: any) => {
                                tieredTasks.push({ ...t, milestoneId: t.milestoneId || 'general' });
                            });
                        }

                        // Use the extracted tasks if we found any
                        if (tieredTasks.length > 0) sourceTasks = tieredTasks;
                    }

                    // Apply scoped filtering based on stats board selection
                    const filteredTasks = sourceTasks.filter((t: any) => {
                        const tMId = t.milestoneId || "";
                        const matchesMilestone = !selectedMilestoneId || selectedMilestoneId === 'all' || String(tMId) === String(selectedMilestoneId);
                        return matchesMilestone;
                    });

                    // Filter for My Work if needed
                    let displayTasks = filteredTasks;
                    if (viewMode === 'my-work') {
                        // Show all my priority tasks for this project regardless of milestone
                        displayTasks = myWorkTasks;
                    }

                    if (loadingTasks) {
                        return (
                            <div style={{ textAlign: 'center', height: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f8fafc', borderRadius: '20px', border: '1px dashed #e2e8f0' }}>
                                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-color)' }} />
                                <p style={{ marginTop: '1rem', fontWeight: 600, color: '#64748b' }}>Fetching your tasks...</p>
                            </div>
                        );
                    }

                    if (displayTasks.length === 0) {
                        return (
                            <div style={{ textAlign: 'center', height: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', background: '#f8fafc', borderRadius: '20px', border: '1px dashed #e2e8f0' }}>
                                <Activity size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>No tasks found for the current filter.</p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem' }}>Try selecting a different milestone or adjusting your focus.</p>
                            </div>
                        );
                    }

                    return (
                        <div style={{ height: '340px', overflowY: 'auto', paddingRight: '10px', marginRight: '-10px' }} className="custom-scrollbar">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '4px' }}>
                                {displayTasks.map((task: any) => {
                                    const tId = task.id || task.taskId;
                                    const isEx = expandedTasks.includes(tId);
                                    const sColors = getStatusColor(task.status);
                                    const aId = task.memberId || (task as any).assignedToId;
                                    const assignee = members.find(mbr => (mbr.id || mbr.memberId || mbr.membershipId || "") === aId);

                                    // Robust collaborator count check
                                    const collabCount = (task.collaborators?.length || 0) > 0
                                        ? task.collaborators.length
                                        : (task.supportMembers?.length || 0) > 0
                                            ? task.supportMembers.length
                                            : (task.collaboratorIds || []).filter((id: string) => id !== aId).length;

                                    const pColors = task.priority === 4 ? { bg: '#fef2f2', text: '#ef4444', label: 'CRITICAL' } :
                                        task.priority === 3 ? { bg: '#fff7ed', text: '#f97316', label: 'HIGH' } :
                                            task.priority === 2 ? { bg: '#eff6ff', text: '#3b82f6', label: 'MEDIUM' } :
                                                { bg: '#f1f5f9', text: '#64748b', label: 'LOW' };

                                    return (
                                        <div
                                            key={tId}
                                            className="hover-lift"
                                            onClick={() => toggleTaskExpand(tId)}
                                            style={{
                                                background: 'white', padding: isEx ? '16px 18px 20px 18px' : '14px 18px', borderRadius: '4px',
                                                border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: isEx ? '16px' : '0',
                                                boxShadow: isEx ? '0 10px 25px rgba(0,0,0,0.05)' : '0 2px 12px rgba(0,0,0,0.02)',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                flexShrink: 0
                                            }}
                                        >
                                            {isEx && <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--primary-color)' }} />}

                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 140px 180px 80px 100px 100px', gap: '16px', alignItems: 'center' }}>
                                                {/* Task Name & Main Info */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                                    <div style={{ color: isEx ? 'var(--primary-color)' : '#94a3b8', flexShrink: 0 }}>
                                                        {isEx ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div title={task.name} style={{ fontSize: '0.9rem', fontWeight: 750, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {task.name}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Assignee & Collab */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '4px 10px', borderRadius: '12px', border: '1px solid #f1f5f9', minWidth: 0 }}>
                                                        <User size={12} style={{ color: '#94a3b8' }} />
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 650, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {assignee?.fullName || assignee?.userName || task.assignedToName || (task as any).assigneeName || "Unassigned"}
                                                        </span>
                                                    </div>
                                                    {collabCount > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '4px 8px', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                                            <Users size={12} />
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>{collabCount}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Dates */}
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Calendar size={13} style={{ color: '#94a3b8' }} />
                                                    <span>{formatProjectDate(task.startDate)} – {formatProjectDate(task.dueDate)}</span>
                                                </div>

                                                {/* Priority */}
                                                <div style={{
                                                    fontSize: '0.6rem', fontWeight: 900, padding: '3px 8px', borderRadius: '8px',
                                                    background: pColors.bg, color: pColors.text, textAlign: 'center',
                                                    letterSpacing: '0.04em', border: `1px solid ${pColors.text}15`
                                                }}>
                                                    {pColors.label}
                                                </div>

                                                {/* Status Badge */}
                                                <div style={{
                                                    fontSize: '0.65rem', fontWeight: 800, padding: '4px 12px', borderRadius: '12px',
                                                    background: sColors.bg, color: sColors.text, textAlign: 'center',
                                                    border: `1px solid ${sColors.text}10`, width: 'fit-content', justifySelf: 'center'
                                                }}>
                                                    {getStatusText(task.status)}
                                                </div>

                                                {/* Quick Actions */}
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                                                    {(task.status === TaskStatus.Todo && aId === myMembershipId) && (
                                                        <button
                                                            onClick={() => handleUpdateTaskStatus(tId, TaskStatus.InProgress)}
                                                            disabled={submitting === tId}
                                                            style={{
                                                                width: '34px', height: '34px', borderRadius: '10px', background: '#f0f9ff', border: '1px solid #e0f2fe',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9', cursor: submitting === tId ? 'not-allowed' : 'pointer'
                                                            }}
                                                            title="Start Task"
                                                        >
                                                            {submitting === tId ? <Loader2 size={16} className="animate-spin-slow" /> : <Play size={16} />}
                                                        </button>
                                                    )}
                                                    {((task.status === TaskStatus.InProgress || task.status === TaskStatus.Adjusting) && aId === myMembershipId) && (
                                                        <button
                                                            onClick={() => handleUpdateTaskStatus(tId, TaskStatus.Submitted)}
                                                            disabled={submitting === tId}
                                                            style={{
                                                                width: '34px', height: '34px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #dcfce7',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', cursor: submitting === tId ? 'not-allowed' : 'pointer'
                                                            }}
                                                            title="Submit for Review"
                                                        >
                                                            {submitting === tId ? <Loader2 size={16} className="animate-spin-slow" /> : <Send size={16} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded Content: Description */}
                                            {isEx && (
                                                <div
                                                    style={{
                                                        marginTop: '4px',
                                                        padding: '12px 16px',
                                                        background: '#f8fafc',
                                                        borderRadius: '12px',
                                                        border: '1px solid #f1f5f9',
                                                        animation: 'fadeIn 0.2s ease-out'
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Task Description</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>
                                                        {task.description || "No description provided for this task."}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </section>
        </div>
    );
};

export default DetailsHome;
