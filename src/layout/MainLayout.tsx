import React from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import Header from '@/components/navigation/Header';
import ToastContainer from '@/components/feedback/ToastContainer';
import Breadcrumbs from '@/components/navigation/Breadcrumbs';

interface MainLayoutProps {
    children: React.ReactNode;
    role?: string;
    userName?: string;
    customSidebar?: React.ReactNode;
    hideSidebar?: boolean;
    hideBreadcrumbs?: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, customSidebar, hideSidebar = false, hideBreadcrumbs = false }) => {
    const showSidebar = !hideSidebar;

    return (
        <div className={`app-layout ${showSidebar ? '' : 'no-sidebar'}`}>
            {showSidebar && (customSidebar || <Sidebar />)}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' }}>
                <Header />
                <main className={`main-content ${showSidebar ? '' : 'no-sidebar'}`} style={{ overflowY: 'auto', flex: 1 }}>
                    <div className="content-container" style={{ padding: '1.5rem 2rem' }}>
                        {!hideBreadcrumbs && <Breadcrumbs />}
                        {children}
                    </div>
                </main>
            </div>
            <ToastContainer />
        </div>
    );
};

export default MainLayout;
