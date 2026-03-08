import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Layout,
    Target,
    Users,
    CheckCircle2,
    ArrowLeft,
    Settings,
    Box
} from 'lucide-react';

interface ProjectSidebarProps {
    projectId: string;
    projectName: string;
    activeTab: string;
    onTabChange: (tab: any) => void;
    roleName?: string;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ projectId, projectName, activeTab, onTabChange, roleName }) => {
    const navigate = useNavigate();

    const navItems = [
        { id: 'home', icon: <Layout size={20} />, label: 'Workspace Home' },
        { id: 'tasks', icon: <CheckCircle2 size={20} />, label: 'Task Board' },
        { id: 'milestones', icon: <Target size={20} />, label: 'Milestones' },
        { id: 'members', icon: <Users size={20} />, label: 'Research Team' },
    ];

    return (
        <aside className="sidebar" style={{ background: '#001d3d', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'var(--accent-color)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    marginBottom: '1rem'
                }}>
                    <Box size={14} />
                    PROJECT WORKSPACE
                </div>
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
                    marginBottom: '1rem',
                    boxShadow: '0 4px 12px rgba(42, 111, 151, 0.3)'
                }}>
                    {(projectName || 'P').charAt(0).toUpperCase()}
                </div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {projectName || 'Untitled Project'}
                </h2>
                {roleName && (
                    <div style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', color: '#93c5fd', display: 'inline-flex' }}>
                        {roleName}
                    </div>
                )}
            </div>

            <nav style={{ padding: '1.5rem 0', flex: 1 }}>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        style={{
                            display: 'flex',
                            width: '100%',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '0.9rem 1.5rem',
                            color: activeTab === item.id ? 'white' : 'rgba(255,255,255,0.5)',
                            background: activeTab === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
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

                <div style={{ margin: '1rem 0', height: '1px', background: 'rgba(255,255,255,0.05)' }} />

                <Link
                    to={`/projects/edit/${projectId}`}
                    style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '0.9rem 1.5rem',
                        color: activeTab === 'settings' ? 'white' : 'rgba(255,255,255,0.5)',
                        background: activeTab === 'settings' ? 'rgba(255,255,255,0.08)' : 'transparent',
                        borderLeft: activeTab === 'settings' ? '4px solid var(--accent-color)' : '4px solid transparent',
                        fontSize: '0.9rem',
                        textDecoration: 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    <Settings size={20} />
                    Configuration
                </Link>
            </nav>

            <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                    onClick={() => navigate('/projects')}
                    style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '0.75rem 1rem',
                        color: 'rgba(255,255,255,0.5)',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <ArrowLeft size={16} />
                    Leave Project Space
                </button>
            </div>
        </aside>
    );
};

export default ProjectSidebar;
