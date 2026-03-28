import { createBrowserRouter, Navigate } from 'react-router-dom';
import Dashboard from '@/pages/dashboard/Dashboard';
import LoginPage from '@/pages/auth/LoginPage';
import Projects from '@/pages/project/Projects';
import Tasks from '@/pages/task/Tasks';
import Members from '@/pages/member/Members';
import ProjectDetails from '@/pages/project/ProjectDetails';
import CreateProject from '@/pages/project/CreateProject';
import EditProject from '@/pages/project/EditProject';
import CreateTask from '@/pages/task/CreateTask';
import Home from '@/pages/home/Home';
import PublicProjectDetails from '@/pages/project/PublicProjectDetails';
import AuthGuard from '@/components/auth/AuthGuard';
import Reports from '@/pages/report/Reports';
import CreateReport from '@/pages/report/CreateReport';
import ReportDetail from '@/pages/report/ReportDetail';
import ResourceBooking from '@/pages/resource/ResourceBooking';
import LabResourceAdmin from '@/pages/admin/LabResourceAdmin';
import ComingSoon from '@/pages/common/ComingSoon';
import UserManagement from '@/pages/user-management/UserManagement';
import PaperSubmissions from '@/pages/paper/PaperSubmissions';
import PaperReview from '@/pages/paper/PaperReview';
import ProfilePage from '@/pages/profile/ProfilePage';
import RoleGuard from '@/components/auth/RoleGuard';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <Navigate to="/login" replace />,
    },
    {
        path: '/login',
        element: <LoginPage />,
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
        path: '/projects/new',
        element: <AuthGuard><CreateProject /></AuthGuard>,
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
        path: '/projects/edit/:id',
        element: <AuthGuard><EditProject /></AuthGuard>,
    },
    {
        path: '/tasks',
        element: <AuthGuard><Tasks /></AuthGuard>,
    },
    {
        path: '/tasks/new',
        element: <AuthGuard><CreateTask /></AuthGuard>,
    },
    {
        path: '/members',
        element: <AuthGuard><Members /></AuthGuard>,
    },
    {
        path: '/papers',
        element: <AuthGuard><RoleGuard allowedRoles={[3, 4]}><PaperSubmissions /></RoleGuard></AuthGuard>,
    },
    {
        path: '/paper-review',
        element: <AuthGuard><RoleGuard allowedRoles={[2]}><PaperReview /></RoleGuard></AuthGuard>,
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
        path: '/admin/resources',
        element: <AuthGuard><LabResourceAdmin /></AuthGuard>,
    },
    {
        path: '/admin/logs',
        element: <AuthGuard><LabResourceAdmin initialTab="logs" /></AuthGuard>,
    },
    {
        path: '/schedules',
        element: <AuthGuard><ComingSoon title="Schedules" /></AuthGuard>,
    },
    {
        path: '/seminars',
        element: <AuthGuard><ComingSoon title="Seminars" /></AuthGuard>,
    },
    {
        path: '/profile',
        element: <AuthGuard><ProfilePage /></AuthGuard>,
    },
    {
        path: '/user-management',
        element: <AuthGuard><RoleGuard allowedRoles={[1]}><UserManagement /></RoleGuard></AuthGuard>,
    },
    {
        path: '*',
        element: <Navigate to="/login" replace />,
    },
]);
