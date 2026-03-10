import React from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import Header from '@/components/navigation/Header';
import { useAuth } from '@/hooks/useAuth';

interface MainLayoutProps {
    children: React.ReactNode;
    role?: string;
    userName?: string;
    customSidebar?: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, role, userName, customSidebar }) => {
    const { user } = useAuth();

    // Fallback to props if user is still loading, otherwise use actual auth user
    const displayRole = user?.role || role || 'Researcher';
    // Use user name from auth, then props, fallback to generic
    const displayUserName = user?.name || userName || 'Current User';

    return (
        <div className="app-layout">
            {customSidebar || <Sidebar />}
            <div style={{ flex: 1 }}>
                <Header role={displayRole} userName={displayUserName} />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
