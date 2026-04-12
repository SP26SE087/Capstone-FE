import React from 'react';
import { Project, ProjectStatus } from '@/types';
import { getProjectStatusStyle, isDefaultDate } from '@/utils/projectUtils';
import { AlertTriangle, Clock } from 'lucide-react';

interface ProjectCardProps {
    project: Project;
    onClick: (id: string) => void;
}

const DEADLINE_WARN_DAYS = 7;

type DeadlineState = 'overdue' | 'soon' | null;

const getDeadlineState = (project: Project): DeadlineState => {
    const alertable = project.status === ProjectStatus.Active || project.status === ProjectStatus.Inactive;
    if (!alertable) return null;
    if (isDefaultDate(project.endDate)) return null;

    const end = new Date(project.endDate!);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= DEADLINE_WARN_DAYS) return 'soon';
    return null;
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
    const totalTasks = project.totalTasks ?? (project as any).TotalTasks ?? 0;
    const completedTasks = project.completedTasks ?? (project as any).CompletedTasks ?? 0;
    const progress = project.progress !== undefined
        ? project.progress
        : (totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0);

    const deadlineState = getDeadlineState(project);

    const endDateStr = !isDefaultDate(project.endDate)
        ? new Date(project.endDate!).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null;

    return (
        <div
            className="card"
            onClick={() => onClick(project.projectId)}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: deadlineState === 'overdue' ? '1.5px solid #fca5a5' : deadlineState === 'soon' ? '1.5px solid #fde68a' : undefined,
            }}
        >
            {/* Deadline banner */}
            {deadlineState === 'overdue' && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 12px', margin: '-1rem -1rem 0',
                    background: '#fef2f2', borderBottom: '1px solid #fca5a5',
                    fontSize: '0.78rem', fontWeight: 700, color: '#dc2626',
                    borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                }}>
                    <AlertTriangle size={14} />
                    Overdue{endDateStr ? ` · ${endDateStr}` : ''}
                </div>
            )}
            {deadlineState === 'soon' && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 12px', margin: '-1rem -1rem 0',
                    background: '#fffbeb', borderBottom: '1px solid #fde68a',
                    fontSize: '0.78rem', fontWeight: 700, color: '#d97706',
                    borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                }}>
                    <Clock size={14} />
                    Due soon{endDateStr ? ` · ${endDateStr}` : ''}
                </div>
            )}
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
