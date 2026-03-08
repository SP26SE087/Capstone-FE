import React from 'react';
import { Project } from '@/types';
import { getProjectStatusStyle } from '@/utils/projectUtils';


interface ProjectCardProps {
    project: Project;
    onClick: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
    const progress = project.totalTasks && project.totalTasks > 0
        ? Math.round((project.completedTasks || 0) / project.totalTasks * 100)
        : 0;

    return (
        <div
            className="card"
            onClick={() => onClick(project.id)}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{project.projectName || (project as any).name || 'Untitled Project'}</h3>
                <span style={{
                    fontSize: '0.65rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: getProjectStatusStyle(project.status).bg,
                    color: getProjectStatusStyle(project.status).color,
                    fontWeight: 600,
                    textTransform: 'uppercase'
                }}>
                    {getProjectStatusStyle(project.status).label}
                </span>
            </div>

            <p style={{
                margin: 0,
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
            }}>
                {project.projectDescription || (project as any).description || "No description provided."}
            </p>

            <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{progress}%</span>
                </div>
                <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--accent-color), var(--primary-color))',
                        borderRadius: '3px'
                    }} />
                </div>
            </div>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-color)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)'
            }}>
                <span>{project.membersCount ?? project.members?.length ?? 0} Members</span>
            </div>
        </div>
    );
};


export default ProjectCard;
