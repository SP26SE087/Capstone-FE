import { createBrowserRouter, Navigate } from 'react-router-dom';
import Dashboard from '@/pages/dashboard/Dashboard';
import LoginPage from '@/pages/auth/LoginPage';
import LandingPage from '@/pages/landing/LandingPage';
import PrivacyPage from '@/pages/legal/PrivacyPage';
import TermsPage from '@/pages/legal/TermsPage';
import Projects from '@/pages/project/Projects';
import Tasks from '@/pages/task/Tasks';
import Members from '@/pages/member/Members';
import ProjectDetails from '@/pages/project/ProjectDetails';
import Home from '@/pages/home/Home';
import PublicProjectDetails from '@/pages/project/PublicProjectDetails';
import AuthGuard from '@/components/auth/AuthGuard';
import Reports from '@/pages/report/Reports';
import CreateReport from '@/pages/report/CreateReport';
import ReportDetail from '@/pages/report/ReportDetail';
import ResourceBooking from '@/pages/resource/ResourceBooking';
import NewBookingPage from '@/pages/resource/NewBookingPage';
import TerminalPage from '@/pages/resource/TerminalPage';
import LabResourceAdmin from '@/pages/admin/LabResourceAdmin';
import ComputeServerAdmin from '@/pages/admin/ComputeServerAdmin';
import Schedules from '@/pages/schedule/Schedules';
import Seminars from '@/pages/seminar/Seminars';
import UserManagement from '@/pages/user-management/UserManagement';
import PaperSubmissions from '@/pages/paper/PaperSubmissions';
import ProfilePage from '@/pages/profile/ProfilePage';
import RoleGuard from '@/components/auth/RoleGuard';
import LabProjects from '@/pages/project/LabProjects';
import VisitorRegistrations from '@/pages/schedule/VisitorRegistrations';
import ContactorsPage from '@/pages/admin/ContactorsPage';
import CameraMonitorPage from '@/pages/admin/CameraMonitorPage';
import ServerSetupGuidePage from '@/pages/admin/ServerSetupGuidePage';
import PublicPapersPage from '@/pages/landing/PublicPapersPage';
import PublicSeminarsPage from '@/pages/landing/PublicSeminarsPage';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <LandingPage />,
    },
    {
        path: '/login',
        element: <LoginPage />,
    },
    {
        path: '/privacy',
        element: <PrivacyPage />,
    },
    {
        path: '/terms',
        element: <TermsPage />,
    },
    {
        path: '/home',
        element: <AuthGuard><Home /></AuthGuard>,
    },
    {
        path: '/dashboard',
        element: <AuthGuard><Dashboard /></AuthGuard>,
    },
    {
        path: '/projects',
        element: <AuthGuard><Projects /></AuthGuard>,
    },
    {
        path: '/projects/:id',
        element: <AuthGuard><ProjectDetails /></AuthGuard>,
    },
    {
        path: '/home/projects/:id',
        element: <AuthGuard><PublicProjectDetails /></AuthGuard>,
    },
    {
        path: '/tasks',
        element: <AuthGuard><Tasks /></AuthGuard>,
    },
    {
        path: '/members',
        element: <AuthGuard><Members /></AuthGuard>,
    },
    {
        path: '/papers',
        element: <AuthGuard><RoleGuard allowedRoles={[2, 3, 4]}><PaperSubmissions /></RoleGuard></AuthGuard>,
    },
    {
        path: '/reports',
        element: <AuthGuard><Reports /></AuthGuard>,
    },
    {
        path: '/reports/new',
        element: <AuthGuard><CreateReport /></AuthGuard>,
    },
    {
        path: '/reports/:id',
        element: <AuthGuard><ReportDetail /></AuthGuard>,
    },
    {
        path: '/bookings',
        element: <AuthGuard><ResourceBooking /></AuthGuard>,
    },
    {
        path: '/bookings/new',
        element: <AuthGuard><NewBookingPage /></AuthGuard>,
    },
    {
        path: '/bookings/:bookingId/terminal',
        element: <AuthGuard><TerminalPage /></AuthGuard>,
    },
    {
        path: '/admin/resources',
        element: <AuthGuard><RoleGuard allowedRoles={[2]}><LabResourceAdmin /></RoleGuard></AuthGuard>,
    },
    {
        path: '/admin/logs',
        element: <AuthGuard><RoleGuard allowedRoles={[2]}><LabResourceAdmin initialTab="logs" /></RoleGuard></AuthGuard>,
    },
    {
        path: '/admin/servers',
        element: <AuthGuard><RoleGuard allowedRoles={[2]}><LabResourceAdmin initialTab="servers" /></RoleGuard></AuthGuard>,
    },
    {
        path: '/admin/compute',
        element: <AuthGuard><RoleGuard allowedRoles={[1]}><ComputeServerAdmin /></RoleGuard></AuthGuard>,
    },
    {
        path: '/schedules',
        element: <AuthGuard><Schedules /></AuthGuard>,
    },
    {
        path: '/seminars',
        element: <AuthGuard><Seminars /></AuthGuard>,
    },
    {
        path: '/profile',
        element: <AuthGuard><ProfilePage /></AuthGuard>,
    },
    {
        path: '/lab-projects',
        element: <AuthGuard><RoleGuard allowedRoles={[2, 3, 4]}><LabProjects /></RoleGuard></AuthGuard>,
    },

    {
        path: '/user-management',
        element: <AuthGuard><RoleGuard allowedRoles={[1]}><UserManagement /></RoleGuard></AuthGuard>,
    },
    {
        path: '/visitor-registrations',
        element: <AuthGuard><VisitorRegistrations /></AuthGuard>,
    },
    {
        path: '/admin/contactors',
        element: <AuthGuard><RoleGuard allowedRoles={[1]}><ContactorsPage /></RoleGuard></AuthGuard>,
    },
    {
        path: '/admin/camera-monitor',
        element: <AuthGuard><RoleGuard allowedRoles={[1, 2]}><CameraMonitorPage /></RoleGuard></AuthGuard>,
    },
    {
        path: '/admin/server-setup-guide',
        element: <AuthGuard><RoleGuard allowedRoles={[1, 2]}><ServerSetupGuidePage /></RoleGuard></AuthGuard>,
    },
    {
        path: '/public/papers',
        element: <PublicPapersPage />,
    },
    {
        path: '/public/seminars',
        element: <PublicSeminarsPage />,
    },
    {
        path: '*',
        element: <Navigate to="/login" replace />,
    },
]);
