import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import { taskService } from '@/services';
import { Task } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import TaskFilters from './components/TaskFilters';
import TaskTable from './components/TaskTable';
import TaskDetailPanel from './components/TaskDetailPanel';

const TASKS_PER_PAGE = 8;

const Tasks: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterProject, setFilterProject] = useState('all');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const data = await taskService.getPriorityTasks();
            setTasks(data || []);
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTasks(); }, []);
    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterProject, startDateFilter, endDateFilter]);

    const projects = useMemo(
        () => Array.from(new Set(tasks.map(t => t.projectName || t.projectId).filter(Boolean))) as string[],
        [tasks]
    );

    const filteredTasks = useMemo(() => tasks.filter(task => {
        if (!task.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filterStatus !== 'all' && task.status.toString() !== filterStatus) return false;
        if (filterProject !== 'all' && (task.projectName || task.projectId) !== filterProject) return false;
        if (!task.dueDate) return !startDateFilter && !endDateFilter;
        const t = new Date(task.dueDate).getTime();
        if (startDateFilter && t < new Date(startDateFilter).getTime()) return false;
        if (endDateFilter && t > new Date(endDateFilter).getTime()) return false;
        return true;
    }), [tasks, searchTerm, filterStatus, filterProject, startDateFilter, endDateFilter]);

    const totalPages = Math.ceil(filteredTasks.length / TASKS_PER_PAGE);
    const paginatedTasks = filteredTasks.slice((currentPage - 1) * TASKS_PER_PAGE, currentPage * TASKS_PER_PAGE);

    return (
        <MainLayout role={currentUser.role} userName={currentUser.name}>
            <div className="page-container">
                <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <h1>My Tasks in Lab</h1>
                        <p>Track and update your research activities and deadlines.</p>
                    </div>
                </div>

                <TaskFilters
                    searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                    filterStatus={filterStatus} setFilterStatus={setFilterStatus}
                    filterProject={filterProject} setFilterProject={setFilterProject}
                    startDateFilter={startDateFilter} setStartDateFilter={setStartDateFilter}
                    endDateFilter={endDateFilter} setEndDateFilter={setEndDateFilter}
                    projects={projects}
                />

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <TaskTable
                            tasks={paginatedTasks}
                            selectedTaskId={selectedTaskId}
                            onTaskClick={setSelectedTaskId}
                            loading={loading}
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>

                    {selectedTaskId && (
                        <div style={{ width: '390px', flexShrink: 0, position: 'sticky', top: '1rem' }}>
                            <TaskDetailPanel
                                taskId={selectedTaskId}
                                onClose={() => setSelectedTaskId(null)}
                                onTaskUpdated={fetchTasks}
                            />
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default Tasks;
