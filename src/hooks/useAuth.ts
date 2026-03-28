import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/services/authService';

interface AuthUser {
    userId: string;
    name: string;
    role: string;
    email: string;
    avatarUrl?: string;
}

const GUEST: AuthUser = { userId: '', name: 'Guest User', role: 'Visitor', email: '' };

const getStoredUser = (): AuthUser => {
    const user = authService.getAuthUser();
    if (!user) return GUEST;
    return {
        userId: (user as any).id || (user as any).userId || '',
        name: user.fullName || 'User',
        role: user.role || 'User',
        email: user.email || '',
        avatarUrl: user.avatarUrl,
    };
};

export const useAuth = () => {
    const [user, setUser] = useState<AuthUser>(getStoredUser);
    const loading = false;
    const isAuthenticated = authService.isAuthenticated();

    useEffect(() => {
        const handleAuthUpdate = () => setUser(getStoredUser());
        
        setUser(getStoredUser());
        window.addEventListener('auth_user_updated', handleAuthUpdate);
        
        return () => window.removeEventListener('auth_user_updated', handleAuthUpdate);
    }, []);

    const logout = useCallback(async () => {
        await authService.logout();
        setUser(GUEST);
        window.dispatchEvent(new Event('auth_user_updated'));
        window.location.href = '/login';
    }, []);

    const refreshUser = useCallback(() => {
        setUser(getStoredUser());
        window.dispatchEvent(new Event('auth_user_updated'));
    }, []);

    return { user, loading, isAuthenticated, logout, refreshUser };
};
