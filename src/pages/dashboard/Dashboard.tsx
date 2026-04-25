import { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import {
    BarChart3,
    Clock,
    AlertCircle,
    ArrowUpRight,
    Layers,
    Calendar,
    Presentation,
    ClipboardList,
    BookOpen,
    FileText,
    Box,
    Video,
    Zap,
    ChevronRight,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { TaskStatus, DashboardStats, Project, ProjectStatus, Task } from '@/types';
import { dashboardService, projectService, taskService } from '@/services';
import { getProjectStatusStyle } from '@/utils/projectUtils';
import { useAuth } from '@/hooks/useAuth';
import seminarService from '@/services/seminarService';
import { SeminarMeetingResponse } from '@/types/seminar';
import { bookingService } from '@/services/bookingService';
import { Booking, BookingStatus } from '@/types/booking';
import reportService, { Report } from '@/services/reportService';
import meetingService from '@/services/meetingService';
import { MeetingResponse } from '@/types/meeting';
import { paperSubmissionService } from '@/services/paperSubmissionService';
import { PaperSubmissionResponse, SubmissionStatus } from '@/types/paperSubmission';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const normalizeList = <T,>(payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as T[];
    return [];
};

const parseDateOnly = (value?: string | null): Date | null => {
    if (!value) return null;
    const part = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1];
    if (part) {
        const [year, month, day] = part.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    }
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const isTaskDone = (status: TaskStatus): boolean =>
    status === TaskStatus.Completed || status === TaskStatus.Submitted;

const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatBookingTimeRange = (startTime: string, endTime: string): string => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Schedule pending';
    return `${start.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} · ${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}-${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

const getBookingStatusStyle = (status: BookingStatus): { label: string; bg: string; color: string } => {
    switch (status) {
        case BookingStatus.Pending:
            return { label: 'Pending', bg: 'var(--info-bg)', color: 'var(--info)' };
        case BookingStatus.Approved:
            return { label: 'Approved', bg: 'var(--success-bg)', color: 'var(--success)' };
        case BookingStatus.InUse:
            return { label: 'In Use', bg: 'var(--warning-bg)', color: 'var(--warning)' };
        case BookingStatus.Completed:
            return { label: 'Completed', bg: 'var(--surface-hover)', color: 'var(--text-secondary)' };
        case BookingStatus.Cancelled:
            return { label: 'Cancelled', bg: 'var(--danger-bg)', color: 'var(--danger)' };
        case BookingStatus.Rejected:
            return { label: 'Rejected', bg: 'var(--danger-bg)', color: 'var(--danger)' };
        default:
            return { label: 'Unknown', bg: 'var(--surface-hover)', color: 'var(--text-secondary)' };
    }
};

const getRelativeTime = (startMs: number): string => {
    const diffMs = startMs - Date.now();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 0) return 'Now';
    if (diffMin < 60) return `in ${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (diffH < 24) return remMin > 0 ? `in ${diffH}h ${remMin}m` : `in ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'Tomorrow';
    return `in ${diffD}d`;
};

const categoryMeta: Record<string, { label: string; bg: string; color: string; Icon: React.ElementType }> = {
    meeting: { label: 'Meeting', bg: 'var(--info-bg)', color: 'var(--info)', Icon: Video },
    seminar: { label: 'Seminar', bg: 'var(--accent-bg)', color: 'var(--accent-color)', Icon: Presentation },
    booking: { label: 'Booking', bg: 'var(--warning-bg)', color: 'var(--warning)', Icon: Box },
};

const toneStyle: Record<string, { bg: string; color: string; border: string }> = {
    danger: { bg: 'var(--danger-bg)', color: 'var(--danger)', border: 'rgba(239,68,68,0.25)' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'rgba(245,158,11,0.25)' },
    info: { bg: 'var(--info-bg)', color: 'var(--info)', border: 'rgba(59,130,246,0.25)' },
    success: { bg: 'var(--success-bg)', color: 'var(--success)', border: 'rgba(34,197,94,0.25)' },
};

const getReportStatusMeta = (status: number): { label: string; bg: string; color: string } => {
    switch (status) {
        case 0:
            return { label: 'Drafting', bg: 'var(--surface-hover)', color: 'var(--text-secondary)' };
        case 1:
            return { label: 'Submitted', bg: 'var(--info-bg)', color: 'var(--info)' };
        case 2:
            return { label: 'Approved', bg: 'var(--success-bg)', color: 'var(--success)' };
        case 3:
            return { label: 'Revision', bg: 'var(--danger-bg)', color: 'var(--danger)' };
        default:
            return { label: 'Unknown', bg: 'var(--surface-hover)', color: 'var(--text-secondary)' };
    }
};

function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [seminars, setSeminars] = useState<SeminarMeetingResponse[]>([]);
    const [meetings, setMeetings] = useState<MeetingResponse[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [managedBookings, setManagedBookings] = useState<Booking[]>([]);
    const [myReports, setMyReports] = useState<Report[]>([]);
    const [assignedReports, setAssignedReports] = useState<Report[]>([]);
    const [papers, setPapers] = useState<PaperSubmissionResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [nowMs, setNowMs] = useState(Date.now());

    useEffect(() => {
        const id = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);



    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [
                    statsData,
                    projectsData,
                    tasksData,
                    allTasksData,
                    seminarData,
                    bookingData,
                    managedBookingData,
                    myMeetingsData,
                    invitedMeetingsData,
                    myReportsData,
                    assignedReportsData,
                    paperData,
                ] = await Promise.all([
                    dashboardService.getStats(),
                    projectService.getAll(),
                    taskService.getPriorityTasks(),
                    taskService.getCurrentUserTasks().catch(() => [] as Task[]),
                    seminarService.getInvitedSeminarMeetings().catch(() => [] as SeminarMeetingResponse[]),
                    bookingService.getMyUpcoming().catch(() => [] as Booking[]),
                    bookingService.getManagedAllPages().catch(() => [] as Booking[]),
                    meetingService.getMyMeetings().catch(() => [] as MeetingResponse[]),
                    meetingService.getMyInvitedMeetings().catch(() => [] as MeetingResponse[]),
                    reportService.getMyReports().catch(() => []),
                    reportService.getAssignedReports().catch(() => []),
                    paperSubmissionService
                        .getAll({ pageIndex: 1, pageSize: 200 })
                        .then((response) => response.items ?? [])
                        .catch(() => [] as PaperSubmissionResponse[]),
                ]);
                setStats(statsData);
                setProjects(projectsData || []);
                setTasks(tasksData || []);
                setAllTasks(normalizeList<Task>(allTasksData));

                const now = new Date();
                const upcoming = (seminarData || [])
                    .filter((s: SeminarMeetingResponse) => new Date(`${s.meetingDate}T${s.startTime}`) >= now)
                    .sort((a: SeminarMeetingResponse, b: SeminarMeetingResponse) =>
                        new Date(`${a.meetingDate}T${a.startTime}`).getTime() -
                        new Date(`${b.meetingDate}T${b.startTime}`).getTime()
                    );
                setSeminars(upcoming);

                const upcomingBookings = normalizeList<Booking>(bookingData)
                    .filter((b) => {
                        const endTime = new Date(b.endTime).getTime();
                        return !Number.isNaN(endTime) && endTime >= now.getTime() &&
                            b.status !== BookingStatus.Cancelled &&
                            b.status !== BookingStatus.Rejected;
                    })
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                setBookings(upcomingBookings);

                setManagedBookings(
                    normalizeList<Booking>(managedBookingData)
                        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                );

                const meetingMap = new Map<string, MeetingResponse>();
                [...normalizeList<MeetingResponse>(myMeetingsData), ...normalizeList<MeetingResponse>(invitedMeetingsData)]
                    .forEach((meeting) => {
                        if (meeting.id) meetingMap.set(meeting.id, meeting);
                    });
                const upcomingMeetings = Array.from(meetingMap.values())
                    .filter((meeting) => new Date(meeting.startTime).getTime() >= now.getTime())
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                setMeetings(upcomingMeetings);

                setMyReports(normalizeList<Report>(myReportsData));
                setAssignedReports(normalizeList<Report>(assignedReportsData));
                setPapers(normalizeList<PaperSubmissionResponse>(paperData));
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);


    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const numericRole = Number(user.role);
    const normalizedRole = String(user.role || '').toLowerCase();
    const isApproverRole = numericRole === 1 || numericRole === 2 || normalizedRole.includes('admin') || normalizedRole.includes('labdirector') || normalizedRole.includes('lab director');
    const canAccessPapers = numericRole === 2 || numericRole === 3 || numericRole === 4 || normalizedRole.includes('labdirector') || normalizedRole.includes('senior') || normalizedRole.includes('member');

    const taskRadarSource = allTasks.length > 0 ? allTasks : tasks;

    const deadlineRadar = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const next7Days = new Date(today);
        next7Days.setDate(next7Days.getDate() + 7);
        const next14Days = new Date(today);
        next14Days.setDate(next14Days.getDate() + 14);

        let overdueTasksCount = 0;
        let tasksDueTodayCount = 0;
        let tasksDueWeekCount = 0;

        taskRadarSource.forEach((task) => {
            if (isTaskDone(task.status)) return;
            const dueDate = parseDateOnly(task.dueDate);
            if (!dueDate) return;
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate < today) {
                overdueTasksCount += 1;
                return;
            }
            if (isSameDay(dueDate, today)) {
                tasksDueTodayCount += 1;
                return;
            }
            if (dueDate <= next7Days) {
                tasksDueWeekCount += 1;
            }
        });

        const projectsEndingSoonCount = projects.filter((project) => {
            if (project.status !== ProjectStatus.Active && project.status !== ProjectStatus.Inactive) return false;
            const endDate = parseDateOnly(project.endDate);
            if (!endDate) return false;
            endDate.setHours(0, 0, 0, 0);
            return endDate >= today && endDate <= next14Days;
        }).length;

        let tasksDueThreeDaysCount = 0;
        const next3Days = new Date(today);
        next3Days.setDate(next3Days.getDate() + 3);
        taskRadarSource.forEach((task) => {
            if (isTaskDone(task.status)) return;
            const dueDate = parseDateOnly(task.dueDate);
            if (!dueDate) return;
            dueDate.setHours(0, 0, 0, 0);
            if (dueDate >= today && dueDate <= next3Days) {
                tasksDueThreeDaysCount += 1;
            }
        });

        return {
            overdueTasksCount,
            tasksDueTodayCount,
            tasksDueWeekCount,
            tasksDueThreeDaysCount,
            projectsEndingSoonCount,
        };
    }, [taskRadarSource, projects]);

    const todayEventsCount = useMemo(() => {
        const today = new Date();
        const meetingsToday = meetings.filter((m) => {
            const d = new Date(m.startTime);
            return isSameDay(d, today);
        }).length;
        const seminarsToday = seminars.filter((s) => {
            const d = new Date(s.meetingDate);
            return isSameDay(d, today);
        }).length;
        return meetingsToday + seminarsToday;
    }, [meetings, seminars]);

    const reportReviewPending = assignedReports.filter((r) => r.status !== 2).length;
    const reportDraftCount = myReports.filter((r) => r.status === 0).length;
    const reportSubmittedCount = myReports.filter((r) => r.status === 1).length;
    const reportRevisionCount = myReports.filter((r) => r.status === 3).length;
    const pendingReviewReports = assignedReports.filter((r) => r.status !== 2);

    const pendingBookingApprovals = managedBookings.filter((b) => b.status === BookingStatus.Pending).length;
    const myPendingBookings = bookings.filter((b) => b.status === BookingStatus.Pending).length;
    const papersInInternalReview = papers.filter((paper) => paper.status === SubmissionStatus.InternalReview).length;

    const timelineItems = useMemo(() => {
        const now = Date.now();
        const horizon = now + (7 * 24 * 60 * 60 * 1000);
        const items: Array<{
            id: string;
            title: string;
            meta: string;
            start: number;
            category: 'meeting' | 'seminar' | 'booking';
            path: string;
        }> = [];

        meetings.forEach((meeting) => {
            const start = new Date(meeting.startTime).getTime();
            if (Number.isNaN(start) || start < now || start > horizon) return;
            items.push({
                id: `meeting-${meeting.id}`,
                title: meeting.title || 'Lab Meeting',
                meta: new Date(meeting.startTime).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                start,
                category: 'meeting',
                path: '/schedules',
            });
        });

        seminars.forEach((seminar) => {
            const start = new Date(`${seminar.meetingDate}T${seminar.startTime}`).getTime();
            if (Number.isNaN(start) || start < now || start > horizon) return;
            items.push({
                id: `seminar-${seminar.seminarMeetingId}`,
                title: seminar.title || 'Lab Seminar',
                meta: `${new Date(seminar.meetingDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} · ${seminar.startTime.substring(0, 5)}${seminar.location ? ` · ${seminar.location}` : ''}`,
                start,
                category: 'seminar',
                path: '/seminars',
            });
        });

        bookings.forEach((booking) => {
            const start = new Date(booking.startTime).getTime();
            if (Number.isNaN(start) || start < now || start > horizon) return;
            items.push({
                id: `booking-${booking.bookingId || booking.id}`,
                title: booking.title || booking.resourceName || 'Resource Booking',
                meta: formatBookingTimeRange(booking.startTime, booking.endTime),
                start,
                category: 'booking',
                path: '/bookings',
            });
        });

        return items
            .sort((a, b) => a.start - b.start)
            .slice(0, 10);
    }, [meetings, seminars, bookings]);

    const nextSeminar = seminars[0] ?? null;
    const nextSeminarStart = nextSeminar
        ? new Date(`${nextSeminar.meetingDate}T${nextSeminar.startTime}`).getTime()
        : null;

    const formatCountdown = (startMs: number): string => {
        const diff = Math.max(0, startMs - nowMs);
        const totalSec = Math.floor(diff / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
        return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    };

    const actionQueueItems = useMemo(() => {
        if (isApproverRole) {
            const queue = [
                {
                    key: 'booking-approval',
                    label: 'Pending booking approvals',
                    value: pendingBookingApprovals,
                    hint: 'Requests waiting for manager decision',
                    path: '/bookings',
                    tone: 'warning',
                },
                {
                    key: 'report-review',
                    label: 'Reports waiting your review',
                    value: reportReviewPending,
                    hint: 'Assigned reports not fully approved',
                    path: '/reports',
                    tone: 'info',
                },
            ];

            queue.push(
                canAccessPapers
                    ? {
                        key: 'paper-review',
                        label: 'Papers in internal review',
                        value: papersInInternalReview,
                        hint: 'Paper submissions at review stage',
                        path: '/papers',
                        tone: 'danger',
                    }
                    : {
                        key: 'project-deadline',
                        label: 'Projects ending in 14 days',
                        value: deadlineRadar.projectsEndingSoonCount,
                        hint: 'Active projects near end date',
                        path: '/projects',
                        tone: 'warning',
                    }
            );

            return queue;
        }

        return [
            {
                key: 'task-overdue',
                label: 'Overdue tasks',
                value: deadlineRadar.overdueTasksCount,
                hint: 'Tasks with passed due dates',
                path: '/tasks',
                tone: 'danger',
            },
            {
                key: 'task-urgent',
                label: 'Tasks due in 3 days',
                value: deadlineRadar.tasksDueThreeDaysCount,
                hint: 'Open tasks due soon',
                path: '/tasks',
                tone: 'warning',
            },
            {
                key: 'booking-pending',
                label: 'My pending bookings',
                value: myPendingBookings,
                hint: 'Booking requests waiting approval',
                path: '/bookings',
                tone: 'info',
            },
        ];
    }, [
        isApproverRole,
        pendingBookingApprovals,
        reportReviewPending,
        papersInInternalReview,
        canAccessPapers,
        deadlineRadar.projectsEndingSoonCount,
        deadlineRadar.overdueTasksCount,
        deadlineRadar.tasksDueThreeDaysCount,
        myPendingBookings,
    ]);

    const statCards = [
        { label: 'Active Projects', value: stats?.totalActiveProjects ?? 0, Icon: BarChart3, accent: 'var(--accent-color)', bg: 'var(--accent-bg)', path: '/projects' },
        { label: 'Pending Tasks', value: stats?.pendingTasksCount ?? 0, Icon: Clock, accent: 'var(--info)', bg: 'var(--info-bg)', path: '/tasks' },
        { label: 'Due Soon', value: stats?.approachingDeadlinesCount ?? 0, Icon: AlertCircle, accent: 'var(--danger)', bg: 'var(--danger-bg)', path: '/tasks' },
        { label: 'Today\'s Events', value: todayEventsCount, Icon: Calendar, accent: 'var(--accent-color)', bg: 'var(--accent-bg)', path: '/schedules' },
        { label: 'Upcoming Meetings', value: meetings.length, Icon: Video, accent: 'var(--info)', bg: 'var(--info-bg)', path: '/schedules' },
        { label: 'Upcoming Bookings', value: bookings.length, Icon: Box, accent: 'var(--warning)', bg: 'var(--warning-bg)', path: '/bookings' },
        { label: 'Review Requests', value: reportReviewPending, Icon: FileText, accent: 'var(--primary-color)', bg: 'var(--border-light)', path: '/reports' },
    ];

    const quickLinks = [
        { label: 'Schedule', Icon: Calendar, path: '/schedules', color: 'var(--info)' },
        { label: 'Seminars', Icon: Presentation, path: '/seminars', color: 'var(--accent-color)' },
        { label: 'Reports', Icon: ClipboardList, path: '/reports', color: 'var(--success)' },
        { label: 'Bookings', Icon: Layers, path: '/bookings', color: 'var(--warning)' },
        { label: 'Papers', Icon: FileText, path: '/papers', color: 'var(--danger)' },
        { label: 'Projects', Icon: BookOpen, path: '/projects', color: 'var(--primary-color)' },
    ];

    const reportSummaryItems = [
        { label: 'My Drafts', value: reportDraftCount, color: 'var(--text-secondary)', bg: 'var(--surface-hover)' },
        { label: 'Submitted', value: reportSubmittedCount, color: 'var(--info)', bg: 'var(--info-bg)' },
        { label: 'Need Revision', value: reportRevisionCount, color: 'var(--danger)', bg: 'var(--danger-bg)' },
        { label: 'Need Review', value: reportReviewPending, color: 'var(--accent-color)', bg: 'var(--accent-bg)' },
    ];

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>{getGreeting()}, {user.name?.split(' ')[0] || 'Researcher'}</h1>
                        <p>Here's what's happening in your lab today.</p>
                    </div>
                </div>

                {/* Urgency Banner */}
                {!loading && (deadlineRadar.overdueTasksCount > 0 || (isApproverRole && pendingBookingApprovals > 0)) && (
                    <div
                        onClick={() => navigate(isApproverRole ? '/bookings' : '/tasks')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1.1rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--danger-bg)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            marginBottom: '1.25rem',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                        <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', flex: 1 }}>
                            {isApproverRole
                                ? `${pendingBookingApprovals} booking request${pendingBookingApprovals > 1 ? 's' : ''} waiting your approval`
                                : `${deadlineRadar.overdueTasksCount} task${deadlineRadar.overdueTasksCount > 1 ? 's' : ''} past due — review now`}
                        </p>
                        <ChevronRight size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                    </div>
                )}

                {/* Countdown to next seminar */}
                {!loading && (
                    <div
                        onClick={() => navigate('/seminars')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '0.85rem 1.25rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--accent-bg)',
                            border: '1px solid rgba(232,114,12,0.3)',
                            marginBottom: '1rem',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                            flexWrap: 'wrap',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                        <div style={{
                            width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                            background: 'rgba(232,114,12,0.15)', border: '1px solid rgba(232,114,12,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--accent-color)', flexShrink: 0,
                        }}>
                            <Presentation size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 1px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Next Seminar
                            </p>
                            <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {nextSeminar ? (nextSeminar.title || 'Lab Seminar') : 'No upcoming seminars'}
                            </p>
                            {nextSeminar && (
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {new Date(nextSeminar.meetingDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    {' · '}{nextSeminar.startTime?.substring(0, 5)}
                                    {nextSeminar.location ? ` · ${nextSeminar.location}` : ''}
                                </p>
                            )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ margin: '0 0 2px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Starts in
                            </p>
                            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: nextSeminarStart ? 'var(--accent-color)' : 'var(--text-muted)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                                {nextSeminarStart ? formatCountdown(nextSeminarStart) : '—'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Stats Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '0.65rem',
                    marginBottom: '1.75rem'
                }}>
                    {statCards.map(({ label, value, Icon, accent, bg, path }, i) => (
                        <div
                            key={i}
                            className="card card-interactive"
                            onClick={() => navigate(path)}
                            style={{
                                padding: '0.75rem 0.85rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                cursor: 'pointer',
                                minWidth: 0,
                                textAlign: 'center',
                            }}
                        >
                            <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: 'var(--radius-sm)',
                                background: bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: accent,
                                flexShrink: 0
                            }}>
                                <Icon size={16} />
                            </div>
                            <div style={{ minWidth: 0, width: '100%' }}>
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.62rem',
                                    color: 'var(--text-muted)',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    textAlign: 'center',
                                }}>
                                    {label}
                                </p>
                                <p style={{
                                    margin: '1px 0 0',
                                    fontSize: '1.45rem',
                                    fontWeight: 800,
                                    color: 'var(--text-primary)',
                                    lineHeight: 1,
                                    textAlign: 'center',
                                }}>
                                    {loading ? '–' : value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                    {/* Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>My Projects</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Link
                                        to="/projects"
                                        style={{
                                            fontSize: '0.82rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: 'var(--accent-color)',
                                            textDecoration: 'none',
                                            fontWeight: 600
                                        }}
                                    >
                                        View All <ArrowUpRight size={14} />
                                    </Link>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                                {loading ? (
                                    [1, 2].map(i => (
                                        <div key={i} style={{
                                            height: 150,
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--surface-hover)',
                                            border: '1px dashed var(--border-color)'
                                        }} />
                                    ))
                                ) : projects.length > 0 ? (
                                    projects.slice(0, 4).map((proj, index) => {
                                        const pid = proj.projectId || (proj as any).id || (proj as any).ProjectID;
                                        const totalTasks = proj.totalTasks ?? (proj as any).TotalTasks ?? 0;
                                        const completedTasks = proj.completedTasks ?? (proj as any).CompletedTasks ?? 0;
                                        const progress = proj.progress !== undefined
                                            ? proj.progress
                                            : (totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0);
                                        const statusStyle = getProjectStatusStyle(proj.status);

                                        return (
                                            <div
                                                key={pid || index}
                                                onClick={() => pid && navigate(`/projects/${pid}`)}
                                                className="card card-interactive"
                                                style={{
                                                    margin: 0,
                                                    padding: '1.1rem',
                                                    cursor: 'pointer',
                                                    border: '1px solid var(--border-color)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>
                                                        #{(proj.projectId || '').substring(0, 6).toUpperCase()}
                                                    </span>
                                                    <span className="badge" style={{
                                                        background: statusStyle.bg,
                                                        color: statusStyle.color,
                                                        fontSize: '0.65rem'
                                                    }}>
                                                        {statusStyle.label}
                                                    </span>
                                                </div>
                                                <h4 style={{
                                                    margin: 0,
                                                    fontSize: '0.92rem',
                                                    fontWeight: 700,
                                                    lineHeight: 1.35,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}>
                                                    {proj.projectName || (proj as any).name || 'Untitled Project'}
                                                </h4>
                                                <p style={{
                                                    margin: 0,
                                                    fontSize: '0.78rem',
                                                    color: 'var(--text-secondary)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    fontWeight: 500,
                                                    lineHeight: 1.45
                                                }}>
                                                    {proj.projectDescription || (proj as any).description || 'No description provided.'}
                                                </p>
                                                <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                                                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Progress</span>
                                                        <span style={{ fontWeight: 800, color: 'var(--accent-color)' }}>{progress}%</span>
                                                    </div>
                                                    <div className="progress-bar-track" style={{ height: '4px' }}>
                                                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{
                                        gridColumn: '1/-1',
                                        textAlign: 'center',
                                        padding: '2.5rem 1rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <BookOpen size={32} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
                                        <p style={{ margin: 0, fontWeight: 500 }}>You're not involved in any active projects yet.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Priority Tasks */}
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Priority Tasks</h3>
                                <Link
                                    to="/tasks"
                                    style={{
                                        fontSize: '0.82rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: 'var(--accent-color)',
                                        textDecoration: 'none',
                                        fontWeight: 600
                                    }}
                                >
                                    View All <ArrowUpRight size={14} />
                                </Link>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <style>{`@keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`}</style>
                                {loading ? (
                                    [1, 2, 3].map(i => (
                                        <div key={i} style={{
                                            height: 64,
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--surface-hover)',
                                            border: '1px dashed var(--border-color)'
                                        }} />
                                    ))
                                ) : tasks.length > 0 ? (
                                    tasks.slice(0, 5).map((task, index) => {
                                        const daysUntilDue = task.dueDate
                                            ? (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                                            : null;
                                        const isNearDeadline = daysUntilDue !== null &&
                                            task.status !== TaskStatus.Completed &&
                                            task.status !== TaskStatus.Submitted &&
                                            daysUntilDue <= 3;

                                        return (
                                            <div
                                                key={task.taskId || `task-${index}`}
                                                onClick={() => navigate(`/tasks?selectedId=${task.taskId}`)}
                                                style={{
                                                    padding: '0.85rem 1rem',
                                                    background: 'var(--surface-hover)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: `1px solid ${isNearDeadline ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    position: 'relative',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-color)')}
                                                onMouseLeave={e => (e.currentTarget.style.borderColor = isNearDeadline ? 'rgba(239,68,68,0.3)' : 'var(--border-color)')}
                                            >
                                                {isNearDeadline && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: -4,
                                                        right: -4,
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: '50%',
                                                        background: '#ef4444',
                                                        border: '2px solid white',
                                                        boxShadow: '0 0 6px #ef4444',
                                                        animation: 'pulseDot 1s ease-in-out infinite',
                                                        zIndex: 2
                                                    }} />
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{
                                                        margin: '0 0 3px',
                                                        fontSize: '0.88rem',
                                                        fontWeight: 600,
                                                        color: 'var(--text-primary)',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {task.name}
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB') : 'No date'}</span>
                                                        <span>·</span>
                                                        <span>P{task.priority}</span>
                                                    </div>
                                                </div>
                                                <span className="badge badge-muted" style={{ marginLeft: '1rem', flexShrink: 0 }}>
                                                    {TaskStatus[task.status]}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem' }}>
                                        No priority tasks found.
                                    </p>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Quick Access */}
                        <section className="card">
                            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Quick Access</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                                {quickLinks.map(({ label, Icon, path, color }) => (
                                    <button
                                        key={path}
                                        onClick={() => navigate(path)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.55rem',
                                            padding: '0.7rem 0.85rem',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--surface-hover)',
                                            cursor: 'pointer',
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            transition: 'all 0.2s ease',
                                            textAlign: 'left'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = color;
                                            e.currentTarget.style.color = color;
                                            e.currentTarget.style.background = 'white';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                            e.currentTarget.style.color = 'var(--text-primary)';
                                            e.currentTarget.style.background = 'var(--surface-hover)';
                                        }}
                                    >
                                        <Icon size={15} style={{ color, flexShrink: 0 }} />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Action Queue */}
                        <section className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <Zap size={16} style={{ color: 'var(--accent-color)' }} />
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Action Queue</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {loading ? (
                                    [1, 2, 3].map(i => (
                                        <div key={i} style={{ height: 56, borderRadius: 'var(--radius-sm)', background: 'var(--surface-hover)', border: '1px dashed var(--border-color)' }} />
                                    ))
                                ) : actionQueueItems.map((item) => {
                                    const tone = toneStyle[item.tone] ?? toneStyle.info;
                                    const isEmpty = item.value === 0;
                                    return (
                                        <div
                                            key={item.key}
                                            onClick={() => navigate(item.path)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.85rem',
                                                padding: '0.75rem 0.9rem',
                                                borderRadius: 'var(--radius-sm)',
                                                border: `1px solid ${isEmpty ? 'var(--border-color)' : tone.border}`,
                                                background: isEmpty ? 'var(--surface-hover)' : tone.bg,
                                                cursor: 'pointer',
                                                opacity: isEmpty ? 0.6 : 1,
                                                transition: 'opacity 0.15s'
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.opacity = isEmpty ? '0.8' : '0.85')}
                                            onMouseLeave={e => (e.currentTarget.style.opacity = isEmpty ? '0.6' : '1')}
                                        >
                                            <div style={{
                                                minWidth: 36,
                                                height: 36,
                                                borderRadius: 'var(--radius-sm)',
                                                background: isEmpty ? 'var(--border-light)' : tone.bg,
                                                border: `1px solid ${isEmpty ? 'var(--border-color)' : tone.border}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 800,
                                                fontSize: '1rem',
                                                color: isEmpty ? 'var(--text-muted)' : tone.color,
                                                flexShrink: 0,
                                            }}>
                                                {item.value}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ margin: '0 0 2px', fontSize: '0.85rem', fontWeight: 700, color: isEmpty ? 'var(--text-secondary)' : tone.color }}>
                                                    {item.label}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                    {item.hint}
                                                </p>
                                            </div>
                                            <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Upcoming Bookings */}
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Upcoming Bookings</h3>
                                <Link
                                    to="/bookings"
                                    style={{
                                        fontSize: '0.82rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: 'var(--accent-color)',
                                        textDecoration: 'none',
                                        fontWeight: 600
                                    }}
                                >
                                    All <ArrowUpRight size={14} />
                                </Link>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {loading ? (
                                    [1, 2].map(i => (
                                        <div key={i} style={{
                                            height: 66,
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--surface-hover)',
                                            border: '1px dashed var(--border-color)'
                                        }} />
                                    ))
                                ) : bookings.length > 0 ? (
                                    bookings.slice(0, 4).map((booking) => {
                                        const bookingStatus = getBookingStatusStyle(booking.status);
                                        const bookingId = booking.bookingId || booking.id;
                                        return (
                                            <div
                                                key={bookingId}
                                                onClick={() => navigate(bookingId ? `/bookings?selectedId=${bookingId}` : '/bookings')}
                                                style={{
                                                    padding: '0.85rem 1rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--border-color)',
                                                    background: 'var(--surface-hover)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                <div style={{ minWidth: 0 }}>
                                                    <p style={{
                                                        margin: '0 0 3px',
                                                        fontWeight: 700,
                                                        fontSize: '0.88rem',
                                                        color: 'var(--text-primary)',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {booking.title || booking.resourceName || 'Resource Booking'}
                                                    </p>
                                                    <p style={{
                                                        margin: 0,
                                                        fontSize: '0.76rem',
                                                        color: 'var(--text-secondary)',
                                                        fontWeight: 500,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {formatBookingTimeRange(booking.startTime, booking.endTime)}
                                                    </p>
                                                </div>
                                                <span className="badge" style={{ background: bookingStatus.bg, color: bookingStatus.color, flexShrink: 0 }}>
                                                    {bookingStatus.label}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: 'var(--text-muted)' }}>
                                        <Box size={28} style={{ opacity: 0.25, display: 'block', margin: '0 auto 0.5rem' }} />
                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>No upcoming bookings.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Coming Up — unified timeline */}
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Calendar size={16} style={{ color: 'var(--accent-color)' }} />
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Coming Up</h3>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, background: 'var(--surface-hover)', borderRadius: '999px', padding: '2px 8px', border: '1px solid var(--border-color)' }}>
                                        next 7 days
                                    </span>
                                </div>
                                <Link
                                    to="/schedules"
                                    style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}
                                >
                                    Schedule <ArrowUpRight size={14} />
                                </Link>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {loading ? (
                                    [1, 2, 3].map(i => (
                                        <div key={i} style={{ height: 60, borderRadius: 'var(--radius-sm)', background: 'var(--surface-hover)', border: '1px dashed var(--border-color)' }} />
                                    ))
                                ) : timelineItems.length > 0 ? (
                                    timelineItems.map((item, idx) => {
                                        const cat = categoryMeta[item.category];
                                        const CatIcon = cat.Icon;
                                        const isNext = idx === 0;
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => navigate(item.path)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    padding: '0.75rem 0.9rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: `1px solid ${isNext ? cat.color + '55' : 'var(--border-color)'}`,
                                                    background: isNext ? cat.bg : 'var(--surface-hover)',
                                                    cursor: 'pointer',
                                                    transition: 'border-color 0.15s'
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.borderColor = cat.color + '88')}
                                                onMouseLeave={e => (e.currentTarget.style.borderColor = isNext ? cat.color + '55' : 'var(--border-color)')}
                                            >
                                                <div style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: cat.bg,
                                                    border: `1px solid ${cat.color}44`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: cat.color,
                                                    flexShrink: 0,
                                                }}>
                                                    <CatIcon size={14} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{
                                                        margin: '0 0 2px',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        color: 'var(--text-primary)',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {item.title}
                                                    </p>
                                                    <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                        {item.meta}
                                                    </p>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <span style={{
                                                        display: 'block',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        color: isNext ? cat.color : 'var(--text-muted)',
                                                        background: isNext ? cat.bg : 'transparent',
                                                        border: isNext ? `1px solid ${cat.color}44` : 'none',
                                                        borderRadius: '999px',
                                                        padding: isNext ? '2px 7px' : '0',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {getRelativeTime(item.start)}
                                                    </span>
                                                    <span style={{ fontSize: '0.68rem', color: cat.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                                        {cat.label}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                                        <Calendar size={28} style={{ opacity: 0.2, display: 'block', margin: '0 auto 0.5rem' }} />
                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>Nothing scheduled in the next 7 days.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Report Snapshot */}
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Report Snapshot</h3>
                                <Link
                                    to="/reports"
                                    style={{
                                        fontSize: '0.82rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: 'var(--accent-color)',
                                        textDecoration: 'none',
                                        fontWeight: 600
                                    }}
                                >
                                    Open <ArrowUpRight size={14} />
                                </Link>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.9rem' }}>
                                {reportSummaryItems.map((item) => (
                                    <div
                                        key={item.label}
                                        style={{
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '0.65rem 0.7rem',
                                            background: item.bg,
                                            border: '1px solid var(--border-color)'
                                        }}
                                    >
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                            {item.label}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: '1.1rem', lineHeight: 1.1, color: item.color, fontWeight: 800 }}>
                                            {loading ? '–' : item.value}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {loading ? (
                                    [1, 2].map(i => (
                                        <div key={i} style={{
                                            height: 58,
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--surface-hover)',
                                            border: '1px dashed var(--border-color)'
                                        }} />
                                    ))
                                ) : pendingReviewReports.length > 0 ? (
                                    pendingReviewReports.slice(0, 3).map((report) => {
                                        const status = getReportStatusMeta(report.status);
                                        return (
                                            <div
                                                key={report.id}
                                                onClick={() => navigate('/reports')}
                                                style={{
                                                    padding: '0.75rem 0.85rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--border-color)',
                                                    background: 'var(--surface-hover)',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <p style={{
                                                    margin: 0,
                                                    fontSize: '0.82rem',
                                                    fontWeight: 600,
                                                    color: 'var(--text-primary)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {report.title || 'Untitled report'}
                                                </p>
                                                <span className="badge" style={{ background: status.bg, color: status.color, flexShrink: 0 }}>
                                                    {status.label}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', textAlign: 'center', padding: '0.85rem 0.5rem', fontSize: '0.82rem' }}>
                                        No pending review requests.
                                    </p>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>

        </MainLayout>
    );
}

export default Dashboard;
