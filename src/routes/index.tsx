import { createBrowserRouter } from 'react-router-dom';
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
import ComingSoon from '@/pages/common/ComingSoon';

export const router = createBrowserRouter([
    {
        path: '/login',
        element: <LoginPage />,
    },
    {
        path: '/',
        element: <Home />,
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
        path: '/explore/projects/:id',
        element: <PublicProjectDetails />,
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
        path: '/schedules',
        element: <AuthGuard><ComingSoon title="Schedules" /></AuthGuard>,
    },
    {
        path: '/seminars',
        element: <AuthGuard><ComingSoon title="Seminars" /></AuthGuard>,
    },
]);
