import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
    label: string;
    path: string;
    active?: boolean;
}

const Breadcrumbs: React.FC = () => {
    const location = useLocation();
    const rawSegments = location.pathname.split('/').filter((x) => x);

    const getLabel = (path: string): string => {
        const labels: Record<string, string> = {
            'projects': 'Projects',
            'dashboard': 'Dashboard',
            'home': 'Project in Lab',
            'resources': 'Resources',
            'bookings': 'Bookings',
            'inventory': 'Inventory',
            'new': 'New',
            'profile': 'Profile',
            'settings': 'Settings',
            'users': 'Users',
            'server-setup-guide': 'Server Setup Guide'
        };
        
        // Handle UUIDs or IDs (basic check)
        if (path.length > 20 || /\d/.test(path)) {
            return 'Details';
        }
        
        return labels[path] || path.charAt(0).toUpperCase() + path.slice(1);
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { label: 'LabSync', path: '/dashboard' }
    ];

    rawSegments.forEach((value, index) => {
        if (value === 'admin') return;
        const path = `/${rawSegments.slice(0, index + 1).join('/')}`;
        breadcrumbs.push({
            label: getLabel(value),
            path,
            active: index === rawSegments.length - 1
        });
    });

    // Don't show on dashboard itself if you want
    if (location.pathname === '/dashboard') return null;

    return (
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            marginBottom: '1.5rem',
            fontSize: '0.95rem',
            color: 'var(--text-muted)'
        }}>
            {breadcrumbs.map((item, index) => (
                <React.Fragment key={item.path}>
                    {index > 0 && <ChevronRight size={16} style={{ opacity: 0.5 }} />}
                    {item.active ? (
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.label}
                        </span>
                    ) : (
                        <Link 
                            to={item.path} 
                            style={{ 
                                color: 'inherit', 
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            className="breadcrumb-link"
                        >
                            {index === 0 && <Home size={16} />}
                            {item.label}
                        </Link>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
};

export default Breadcrumbs;
