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
        path: '/explore/projects/:id',
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
        path: '*',
        element: <Navigate to="/login" replace />,
    },
]);
