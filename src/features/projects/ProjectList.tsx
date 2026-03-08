import React, { useEffect, useState } from 'react';
import { projectService } from '@/services';
import { Project } from '@/types';
import ProjectCard from '@/components/project/ProjectCard';

const ProjectList: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(true);
            try {
                const data = await projectService.getAll();
                setProjects(data);
            } catch (error) {
                console.error('Error fetching projects:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const handleProjectClick = (id: string) => {
        console.log('Project clicked:', id);
        // Could navigate here if needed, but usually parent handles this
    };

    if (loading) return <div>Loading projects...</div>;

    return (
        <div className="project-list-feature" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', padding: '1rem' }}>
            {projects.length > 0 ? (
                projects.map(project => (
                    <ProjectCard
                        key={project.id}
                        project={project}
                        onClick={handleProjectClick}
                    />
                ))
            ) : (
                <p>No projects found.</p>
            )}
        </div>
    );
};

export default ProjectList;

