import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface RoleGuardProps {
    allowedRoles: number[];
    children: React.ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    const userRole = user ? Number(user.role) : null;

    if (!userRole || !allowedRoles.includes(userRole)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

export default RoleGuard;
