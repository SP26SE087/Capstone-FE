import React from 'react';
import AppSelect from '@/components/common/AppSelect';
import { Search, Calendar, X } from 'lucide-react';
import { TaskStatus } from '@/types';

interface TaskFiltersProps {
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    filterStatus: string;
    setFilterStatus: (v: string) => void;
    filterProject: string;
    setFilterProject: (v: string) => void;
    startDateFilter: string;
    setStartDateFilter: (v: string) => void;
    endDateFilter: string;
    setEndDateFilter: (v: string) => void;
    projects: string[];
}

const TaskFilters: React.FC<TaskFiltersProps> = ({
    searchTerm, setSearchTerm,
    filterStatus, setFilterStatus,
    filterProject, setFilterProject,
    startDateFilter, setStartDateFilter,
    endDateFilter, setEndDateFilter,
    projects,
}) => {
    const hasFilters = !!(searchTerm || filterStatus !== 'all' || filterProject !== 'all' || startDateFilter || endDateFilter);

    const resetAll = () => {
        setSearchTerm('');
        setFilterStatus('all');
        setFilterProject('all');
        setStartDateFilter('');
        setEndDateFilter('');
    };

    return (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: 1, minWidth: '220px', margin: 0, display: 'flex', alignItems: 'center', padding: '0 1.25rem', height: '100%' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search by activity name..."
                        className="form-input"
                        style={{ paddingLeft: '32px', border: 'none', background: 'transparent', boxShadow: 'none', outline: 'none', width: '100%' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div style={{ minWidth: '140px' }}>
                <AppSelect
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                        { value: 'all', label: 'All Status' },
                        { value: String(TaskStatus.Todo), label: 'To Do' },
                        { value: String(TaskStatus.InProgress), label: 'In Progress' },
                        { value: String(TaskStatus.Submitted), label: 'Submitted' },
                        { value: String(TaskStatus.Missed), label: 'Missed' },
                        { value: String(TaskStatus.Adjusting), label: 'Adjusting' },
                        { value: String(TaskStatus.Completed), label: 'Completed' },
                    ]}
                />
            </div>

            <div style={{ minWidth: '160px' }}>
                <AppSelect
                    value={filterProject}
                    onChange={setFilterProject}
                    options={[
                        { value: 'all', label: 'All Projects' },
                        ...projects.map(proj => ({ value: proj, label: proj })),
                    ]}
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="var(--text-muted)" />
                <input type="date" className="form-input" style={{ width: 'auto', fontSize: '0.85rem' }} value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} title="From Due Date" />
                <span style={{ color: 'var(--text-muted)' }}>—</span>
                <input type="date" className="form-input" style={{ width: 'auto', fontSize: '0.85rem' }} value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} title="To Due Date" />
            </div>

            {hasFilters && (
                <button
                    onClick={resetAll}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    <X size={14} /> Reset
                </button>
            )}
        </div>
    );
};

export default TaskFilters;
