import { useState, useEffect } from 'react';
import { Project } from '@/types';
import { projectService } from '@/services';

export const useProjects = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
        setLoading(true);
        try {
            const data = await projectService.getAll();
            setProjects(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch projects');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    return { projects, loading, error, refresh };
};
