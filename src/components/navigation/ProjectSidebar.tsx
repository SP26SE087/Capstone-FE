import React from 'react';

import {
    Layout,
    Target,
    Users,
    CheckCircle2,
    Calendar,
    Settings
} from 'lucide-react';

interface ProjectSidebarProps {
    projectId: string;
    projectName: string;
    activeTab: string;
    onTabChange: (tab: any) => void;
    roleName?: string;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ projectName, activeTab, onTabChange, roleName }) => {


    const navItems = [
        { id: 'home', icon: <Layout size={20} />, label: 'Workspace Home' },
        { id: 'milestones', icon: <Target size={20} />, label: 'Milestones' },
        { id: 'tasks', icon: <CheckCircle2 size={20} />, label: 'Task Board' },
        { id: 'timeline', icon: <Calendar size={20} />, label: 'Project Timeline' },
        { id: 'members', icon: <Users size={20} />, label: 'Research Team' },
    ];

    return (
        <aside className="sidebar" style={{ background: 'var(--primary-color)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'var(--accent-color)',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    marginBottom: '1rem'
                }}>
                </div>
                <div style={{
                    width: '38px',
                    height: '38px',
                    background: 'var(--accent-color)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    marginBottom: '0.75rem',
                    boxShadow: '0 4px 12px rgba(232, 114, 12, 0.3)'
                }}>
                    {(projectName || 'P').charAt(0).toUpperCase()}
                </div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {projectName || 'Untitled Project'}
                </h2>
                {roleName && (
                    <div style={{
                        marginTop: '0.5rem',
                        background: 'rgba(232, 114, 12, 0.15)',
                        padding: '3px 10px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: 'var(--accent-light)',
                        display: 'inline-flex',
                        fontWeight: 600
                    }}>
                        {roleName}
                    </div>
                )}
            </div>

            <nav style={{ padding: '0.75rem 0', flex: 1 }}>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
                        style={{
                            width: '100%',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'inherit'
                        }}
                    >
                        <span className="sidebar-link-icon">{item.icon}</span>
                        <span className="sidebar-link-label">{item.label}</span>
                    </button>
                ))}

                <div style={{ margin: '0.75rem 0', height: '1px', background: 'rgba(255,255,255,0.05)' }} />

                <div className="sidebar-section-label">SETTINGS</div>
                <button
                    onClick={() => onTabChange('settings')}
                    className={`sidebar-link ${activeTab === 'settings' ? 'active' : ''}`}
                    style={{
                        width: '100%', border: 'none', cursor: 'pointer',
                        textAlign: 'left', fontFamily: 'inherit', background: 'transparent'
                    }}
                >
                    <span className="sidebar-link-icon"><Settings size={20} /></span>
                    <span className="sidebar-link-label">Configuration</span>
                </button>
            </nav>


        </aside>
    );
};

export default ProjectSidebar;
