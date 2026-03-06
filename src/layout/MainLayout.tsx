import React from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import Header from '@/components/navigation/Header';

interface MainLayoutProps {
    children: React.ReactNode;
    role: string;
    userName: string;
    customSidebar?: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, role, userName, customSidebar }) => {
    return (
        <div className="app-layout">
            {customSidebar || <Sidebar />}
            <div style={{ flex: 1 }}>
                <Header role={role} userName={userName} />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
