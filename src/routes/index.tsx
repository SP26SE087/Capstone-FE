import { createBrowserRouter } from 'react-router-dom';
import Dashboard from '@/pages/dashboard/Dashboard';
import DevLoginPage from '@/pages/auth/DevLoginPage';
import Projects from '@/pages/project/Projects';
import Tasks from '@/pages/task/Tasks';
import Members from '@/pages/member/Members';
import ProjectDetails from '@/pages/project/ProjectDetails';
import CreateProject from '@/pages/project/CreateProject';
import EditProject from '@/pages/project/EditProject';
import CreateTask from '@/pages/task/CreateTask';
import Home from '@/pages/home/Home';
import PublicProjectDetails from '@/pages/project/PublicProjectDetails';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <Home />,
    },
    {
        path: '/dashboard',
        element: <Dashboard />,
    },
    {
        path: '/projects',
        element: <Projects />,
    },
    {
        path: '/projects/new',
        element: <CreateProject />,
    },
    {
        path: '/projects/:id',
        element: <ProjectDetails />,
    },
    {
        path: '/explore/projects/:id',
        element: <PublicProjectDetails />,
    },
    {
        path: '/projects/edit/:id',
        element: <EditProject />,
    },
    {
        path: '/tasks',
        element: <Tasks />,
    },
    {
        path: '/tasks/new',
        element: <CreateTask />,
    },
    {
        path: '/members',
        element: <Members />,
    },
    {
        path: '/dev/login',
        element: <DevLoginPage />,
    },
]);
