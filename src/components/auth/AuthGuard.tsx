import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '@/services/authService';

interface AuthGuardProps {
    children: React.ReactNode;
}

// Routes that Admin (role 1) is allowed to access
const ADMIN_ALLOWED_PATHS = ['/user-management', '/profile', '/admin/compute'];

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const location = useLocation();

    if (!authService.isAuthenticated()) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const authUser = authService.getAuthUser();
    const isAdmin = authUser && Number(authUser.role) === 1;

    if (isAdmin && !ADMIN_ALLOWED_PATHS.some(p => location.pathname.startsWith(p))) {
        return <Navigate to="/user-management" replace />;
    }

    return <>{children}</>;
};

export default AuthGuard;
