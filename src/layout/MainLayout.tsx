import React from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import Header from '@/components/navigation/Header';

interface MainLayoutProps {
    children: React.ReactNode;
    role?: string;
    userName?: string;
    customSidebar?: React.ReactNode;
    hideSidebar?: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, customSidebar, hideSidebar = false }) => {
    const showSidebar = !hideSidebar;

    return (
        <div className={`app-layout ${showSidebar ? '' : 'no-sidebar'}`}>
            {showSidebar && (customSidebar || <Sidebar />)}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Header />
                <main className={`main-content ${showSidebar ? '' : 'no-sidebar'}`}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
