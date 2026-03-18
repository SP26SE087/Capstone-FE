import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/services/authService';

interface AuthUser {
    name: string;
    role: string;
    email: string;
}

const GUEST: AuthUser = { name: 'Guest User', role: 'Visitor', email: '' };

const getStoredUser = (): AuthUser => {
    const user = authService.getAuthUser();
    if (!user) return GUEST;
    return {
        name: user.fullName || 'User',
        role: user.role || 'User',
        email: user.email || '',
    };
};

export const useAuth = () => {
    const [user, setUser] = useState<AuthUser>(getStoredUser);
    const loading = false;
    const isAuthenticated = authService.isAuthenticated();

    useEffect(() => {
        setUser(getStoredUser());
    }, []);

    const logout = useCallback(async () => {
        await authService.logout();
        setUser(GUEST);
        window.location.href = '/login';
    }, []);

    const refreshUser = useCallback(() => {
        setUser(getStoredUser());
    }, []);

    return { user, loading, isAuthenticated, logout, refreshUser };
};
