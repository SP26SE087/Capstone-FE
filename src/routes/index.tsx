import { createBrowserRouter } from 'react-router-dom';
import App from '@/App';
import DevLoginPage from '@/pages/dev/DevLoginPage';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <App />,
    },
    {
        path: '/dev/login',
        element: <DevLoginPage />,
    },
]);
