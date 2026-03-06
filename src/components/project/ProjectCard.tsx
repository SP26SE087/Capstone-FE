import React from 'react';
import { Project, ProjectStatus } from '@/types';

interface ProjectCardProps {
    project: Project;
    onClick: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
    return (
        <div className="card" onClick={() => onClick(project.id)}>
            <h3>{project.projectName}</h3>
            <p>{project.projectDescription}</p>
            <span>{ProjectStatus[project.status]}</span>
        </div>
    );
};

export default ProjectCard;
