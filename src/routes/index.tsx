import { createBrowserRouter } from 'react-router-dom';
import Dashboard from '@/pages/dashboard/Dashboard';
import DevLoginPage from '@/pages/auth/DevLoginPage';
import Projects from '@/pages/project/Projects';
import Tasks from '@/pages/task/Tasks';
import Members from '@/pages/member/Members';
import ProjectDetails from '@/pages/project/ProjectDetails';
import CreateProject from '@/pages/project/CreateProject';
import CreateTask from '@/pages/task/CreateTask';

export const router = createBrowserRouter([
    {
        path: '/',
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
