import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layout,
    Target,
    Users,
    CheckCircle2,
    ArrowLeft
} from 'lucide-react';

interface ProjectSidebarProps {
    projectId: string;
    projectName: string;
    activeTab: string;
    onTabChange: (tab: any) => void;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ projectName, activeTab, onTabChange }) => {
    const navigate = useNavigate();

    const navItems = [
        { id: 'overview', icon: <Layout size={20} />, label: 'Workspace Home' },
        { id: 'tasks', icon: <CheckCircle2 size={20} />, label: 'Task Board' },
        { id: 'milestones', icon: <Target size={20} />, label: 'Milestones' },
        { id: 'members', icon: <Users size={20} />, label: 'Research Team' },
    ];

    return (
        <aside className="sidebar" style={{ background: '#001d3d' }}>
            <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'var(--accent-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    marginBottom: '1rem'
                }}>
                    {projectName.charAt(0)}
                </div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {projectName}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', margin: '4px 0 0 0' }}>PROJECT SPACE</p>
            </div>

            <nav style={{ padding: '1rem 0', flex: 1 }}>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        style={{
                            display: 'flex',
                            width: '100%',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '0.8rem 1.5rem',
                            color: activeTab === item.id ? 'white' : 'rgba(255,255,255,0.6)',
                            background: activeTab === item.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                            border: 'none',
                            borderLeft: activeTab === item.id ? '4px solid var(--accent-color)' : '4px solid transparent',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            textAlign: 'left',
                            transition: 'all 0.2s'
                        }}
                    >
                        {item.icon}
                        {item.label}
                    </button>
                ))}
            </nav>

            <div style={{ padding: '1rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                    onClick={() => navigate('/projects')}
                    style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '0.8rem 1.5rem',
                        color: 'rgba(255,255,255,0.6)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                    }}
                >
                    <ArrowLeft size={18} />
                    Back to Lab Home
                </button>
            </div>
        </aside>
    );
};

export default ProjectSidebar;
