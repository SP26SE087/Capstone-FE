import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { projectService, milestoneService, membershipService, taskService, researchFieldService } from '@/services';
import { Project, ProjectStatus, ProjectRoleEnum, Milestone, Task, ResearchField } from '@/types';
import { getProjectStatusStyle, isDefaultDate, formatProjectDate, toApiDate } from '@/utils/projectUtils';
import Modal from '@/components/common/Modal';
import Toast, { ToastType } from '@/components/common/Toast';
import { useAuth } from '@/hooks/useAuth';

import {
    ChevronRight,
    Layout,
    CheckCircle2,
    Target,
    Settings as SettingsIcon,
    AlertCircle,
    Home,
    Users
} from 'lucide-react';
/* ProjectRoleEnum already in @/types */

// Import New Modular Components
import DetailsHome from '@/features/projects/components/DetailsHome';
import DetailsMilestones from '@/features/projects/components/DetailsMilestones';
import DetailsMembers from '@/features/projects/components/DetailsMembers';
import DetailsTasks from '@/features/projects/components/DetailsTasks';
import DetailsSettings from '@/features/projects/components/DetailsSettings';

// Import Modals & Other Components
import TaskFormModal from '@/features/tasks/TaskFormModal';
import TaskDetailModal from '@/features/tasks/TaskDetailModal';
import AddMemberModal from '@/features/projects/AddMemberModal';
import MemberDetailModal from '@/features/projects/MemberDetailModal';
import ProjectTimeline from '@/features/projects/ProjectTimeline';

type ActiveTab = 'home' | 'timeline' | 'milestones' | 'members' | 'tasks' | 'settings';

const ProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const [project, setProject] = useState<Project | null>(null);
    const [currentMember, setCurrentMember] = useState<any>(null);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [timelineData, setTimelineData] = useState<any>(null);

    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>(location.state?.activeTab || 'home');
    const [taskView, setTaskView] = useState<'list' | 'kanban'>('list');

    // Modals visibility
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
    const [milestoneViewMode, setMilestoneViewMode] = useState<'roadmap' | 'detail'>('roadmap');
    const [activeMilestoneForTasks, setActiveMilestoneForTasks] = useState<Milestone | null>(null);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [isMemberDetailModalOpen, setIsMemberDetailModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<any>(null);

    // Filters
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
    const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('all');
    const [taskMilestoneFilter, setTaskMilestoneFilter] = useState<string>('all');

    const [milestoneSearchQuery, setMilestoneSearchQuery] = useState('');
    const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<string>('all');
    const [memberSearchQuery, setMemberSearchQuery] = useState('');

    // Settings state
    const [availableFields, setAvailableFields] = useState<ResearchField[]>([]);
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        projectName: '',
        projectDescription: '',
        startDate: '',
        endDate: '',
        status: ProjectStatus.Active
    });
    const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null);
    const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType; duration?: number } | null>(null);

    // Quick creation state
    const [newMilestoneData, setNewMilestoneData] = useState({ name: '', description: '', startDate: '', dueDate: '', status: 0 });
    const [milestoneAddData, setMilestoneAddData] = useState({ name: '', description: '', startDate: '', dueDate: '', status: 0 });
    const [newTasks, setNewTasks] = useState<any[]>([]);
    const milestoneContainerRef = useRef<HTMLDivElement>(null);

    const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
        setToast({ message, type, duration });
    };

    // Data fetching
    const fetchData = async () => {
        if (!id || id === 'undefined') {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const memberInfo = await projectService.getCurrentMember(id);
            if (!memberInfo || !memberInfo.projectRole) {
                navigate(`/explore/projects/${id}`, { replace: true });
                return;
            }
            setCurrentMember(memberInfo);

            const projectData = await projectService.getById(id);
            if (projectData) {
                setProject(projectData);
                setFormData({
                    projectName: projectData.projectName || (projectData as any).name || '',
                    projectDescription: projectData.projectDescription || (projectData as any).description || '',
                    startDate: !isDefaultDate(projectData.startDate) ? new Date(projectData.startDate!).toISOString().split('T')[0] : '',
                    endDate: !isDefaultDate(projectData.endDate) ? new Date(projectData.endDate!).toISOString().split('T')[0] : '',
                    status: projectData.status
                });
                setSelectedFieldIds(projectData.researchFields?.map(f => f.researchFieldId) || []);
            }

            const [milestonesData, membersData, fieldsData, tasksData, timelineResponse] = await Promise.all([
                milestoneService.getByProject(id),
                membershipService.getProjectMembers(id),
                researchFieldService.getAll(),
                taskService.getByProject(id),
                projectService.getMilestoneTasks(id)
            ]);

            setMilestones(milestonesData || []);
            setMembers(membersData || []);
            setAvailableFields(fieldsData || []);
            setTasks(tasksData || []);
            setTimelineData(timelineResponse);
        } catch (error) {
            console.error('Failed to fetch project workspace data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const refetchTasks = async () => {
        if (!id) return;
        try {
            const tasksData = await taskService.getByProject(id);
            setTasks(tasksData || []);
        } catch (error) {
            console.error('Failed to refetch tasks:', error);
        }
    };

    const refetchMilestones = async () => {
        if (!id) return;
        try {
            const milestonesData = await milestoneService.getByProject(id);
            setMilestones(milestonesData || []);
        } catch (error) {
            console.error('Failed to refetch milestones:', error);
        }
    };

    const refetchMembers = async () => {
        if (!id) return;
        try {
            const membersData = await membershipService.getProjectMembers(id);
            setMembers(membersData || []);
        } catch (error) {
            console.error('Failed to refetch members:', error);
        }
    };

    // Handlers for Modals
    const handleTaskClick = (task: Task) => {
        setSelectedTaskId(task.taskId);
        setIsDetailModalOpen(true);
    };

    const handleMilestoneClick = (milestone: Milestone) => {
        setEditingMilestoneId(milestone.milestoneId);
        setNewMilestoneData({
            name: milestone.name,
            description: milestone.description || '',
            startDate: milestone.startDate ? new Date(milestone.startDate).toISOString().split('T')[0] : '',
            dueDate: milestone.dueDate ? new Date(milestone.dueDate).toISOString().split('T')[0] : '',
            status: milestone.status
        });
        // Automatically show tasks for this milestone
        setActiveMilestoneForTasks(milestone);
        setMilestoneViewMode('detail');
    };





    const handleCancelMilestoneEdit = () => {
        setEditingMilestoneId(null);
        // Clear both Edit and Add forms for a clean slate when returning to list
        setNewMilestoneData({ name: '', description: '', startDate: '', dueDate: '', status: 0 });
        setMilestoneAddData({ name: '', description: '', startDate: '', dueDate: '', status: 0 });
        setMilestoneViewMode('roadmap');
        setActiveMilestoneForTasks(null);
    };

    const handleTaskSubmit = async (taskData: any) => {
        try {
            if (editingTask) {
                await taskService.update(editingTask.taskId, { ...taskData, projectId: id });
                showToast('Task updated successfully!', 'success');
            } else {
                await taskService.create({ ...taskData, projectId: id });
                showToast('Task created successfully!', 'success');
            }
            await refetchTasks();
            setIsTaskModalOpen(false);
            setEditingTask(null);
        } catch (error) {
            console.error('Failed to save task:', error);
            showToast('Failed to save task.', 'error');
        }
    };

    // Quick Add Milestone Handlers
    const handleMilestoneDataChange = (field: string, value: any) => {
        if (editingMilestoneId) {
            setNewMilestoneData(prev => ({ ...prev, [field]: value }));
        } else {
            setMilestoneAddData(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleQuickMilestoneSave = async () => {
        if (!id) return;
        const dataToSave = editingMilestoneId ? newMilestoneData : milestoneAddData;
        if (!dataToSave.name || !dataToSave.startDate || !dataToSave.dueDate) {
            showToast('Please fill in all required fields.', 'warning');
            return;
        }
        try {
            if (editingMilestoneId) {
                await milestoneService.update(editingMilestoneId, { ...dataToSave, projectId: id });
                showToast('Milestone updated!', 'success');
            } else {
                await milestoneService.create({ ...dataToSave, projectId: id });
                showToast('Milestone created!', 'success');
                // Only clear add data after successful creation
                setMilestoneAddData({ name: '', description: '', startDate: '', dueDate: '', status: 0 });
            }
            // Reset and refetch
            handleCancelMilestoneEdit();
            await refetchMilestones();
        } catch (error) {
            showToast(`Failed to ${editingMilestoneId ? 'update' : 'create'} milestone.`, 'error');
        }
    };

    // Inline Task Handlers
    const addInlineTask = () => {
        setNewTasks(prev => [
            ...prev,
            { tempId: `temp-${Date.now()}`, name: '', description: '', milestoneId: '', assigneeId: '', endDate: '' }
        ]);
    };

    const removeInlineTask = (id_temp: string) => {
        setNewTasks(prev => prev.filter(t => t.tempId !== id_temp));
    };

    const updateInlineTask = (id_temp: string, field: string, value: any) => {
        setNewTasks(prev => prev.map(t => t.tempId === id_temp ? { ...t, [field]: value } : t));
    };

    const saveInlineTask = async (id_temp: string) => {
        const t = newTasks.find(x => x.tempId === id_temp);
        if (!t || !t.name || !t.endDate) {
            showToast('Please fill in task name and due date.', 'warning');
            return;
        }
        try {
            await taskService.create({
                name: t.name,
                description: t.description,
                milestoneId: t.milestoneId || null,
                memberId: t.assigneeId || null,
                dueDate: new Date(t.endDate).toISOString(),
                projectId: id
            });
            showToast('Task created!', 'success');
            removeInlineTask(id_temp);
            await refetchTasks();
        } catch (error) {
            showToast('Failed to create task.', 'error');
        }
    };

    // Settings Handlers
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleField = (fieldId: string) => {
        setSelectedFieldIds(prev => prev.includes(fieldId) ? prev.filter(x => x !== fieldId) : [...prev, fieldId]);
    };

    const handleSettingsSubmit = async () => {
        if (!id) return;
        setSubmitting(true);
        try {
            await projectService.update({
                projectId: id,
                projectName: formData.projectName,
                projectDescription: formData.projectDescription,
                startDate: toApiDate(formData.startDate),
                endDate: toApiDate(formData.endDate),
                researchFieldIds: selectedFieldIds.filter(fid => fid && fid !== 'null')
            });
            showToast('Project updated successfully!', 'success');
            await fetchData();
        } catch (error) {
            showToast('Failed to update project.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const confirmStatusChange = async () => {
        if (pendingStatus !== null && id) {
            try {
                await projectService.updateStatus(id, pendingStatus);
                setIsStatusConfirmOpen(false);
                showToast(`Status updated to ${ProjectStatus[pendingStatus]}`, 'success');
                await fetchData();
            } catch (error) {
                showToast('Failed to update status.', 'error');
            }
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        try {
            await projectService.delete(id);
            navigate('/projects');
        } catch (error) {
            showToast('Failed to delete project.', 'error');
        }
    };

    // Role calculations
    const projectRoleValue = currentMember?.projectRole || project?.projectRole;
    const isAdmin = currentUser.role === 'Admin';
    const canManageProject = isAdmin || (Number(projectRoleValue) === ProjectRoleEnum.Leader) || (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);
    const canManageMilestones = isAdmin || (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);
    const canAddTask = isAdmin || [ProjectRoleEnum.Leader, ProjectRoleEnum.LabDirector, ProjectRoleEnum.SeniorResearcher].includes(Number(projectRoleValue));
    const isArchived = project?.status === ProjectStatus.Archived;
    const isReadOnly = (isArchived && !isAdmin) || !canManageProject;
    const canDeleteProject = isAdmin || (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);

    // Filtered data
    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(taskSearchQuery.toLowerCase());
        const matchesStatus = taskStatusFilter === 'all' || t.status.toString() === taskStatusFilter;
        const matchesPriority = taskPriorityFilter === 'all' || t.priority.toString() === taskPriorityFilter;
        const matchesMilestone = taskMilestoneFilter === 'all' || t.milestoneId === taskMilestoneFilter;
        return matchesSearch && matchesStatus && matchesPriority && matchesMilestone;
    });

    const filteredMilestones = milestones.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(milestoneSearchQuery.toLowerCase());
        const matchesStatus = milestoneStatusFilter === 'all' || m.status.toString() === milestoneStatusFilter;
        return matchesSearch && matchesStatus;
    });

    const filteredMembers = members.filter(m =>
        (m.fullName || m.userName || '').toLowerCase().includes(memberSearchQuery.toLowerCase())
    );

    const checkOverlap = (start: string, due: string) => {
        if (!start || !due) return false;
        const s = new Date(start).getTime();
        const d = new Date(due).getTime();
        return milestones.some(m => {
            if (m.milestoneId === editingMilestoneId) return false;
            const ms = new Date(m.startDate).getTime();
            const md = new Date(m.dueDate).getTime();
            return (s <= md && d >= ms);
        });
    };

    if (loading) {
        return (
            <MainLayout role={currentUser.role} userName={currentUser.name} hideBreadcrumbs={true}>
                <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    if (!project) {
        return (
            <MainLayout role="Researcher" userName="User" hideBreadcrumbs={true}>
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
                    <h2>Project Not Found</h2>
                    <button onClick={() => navigate('/projects')} className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Projects</button>
                </div>
            </MainLayout>
        );
    }

    const isSoloDirector = members.length === 1 &&
        (Number(members[0].projectRole) === ProjectRoleEnum.LabDirector ||
            members[0].projectRoleName === 'Lab Director');

    return (
        <MainLayout
            role={currentUser.role}
            userName={currentUser.name}
            hideBreadcrumbs={true}
        >
            {toast && <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => setToast(null)} />}

            <div style={{ padding: '0 0 2rem 0' }}>
                {/* Header Breadcrumb */}
                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Home size={14} />
                            LabSync
                        </Link>
                        <ChevronRight size={14} />
                        <Link to="/projects" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Projects</Link>
                        <ChevronRight size={14} />
                        <span style={{ color: 'var(--primary-color)' }}>{project.projectName}</span>
                        <span style={{
                            marginLeft: '12px', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px',
                            background: getProjectStatusStyle(project.status).bg, color: getProjectStatusStyle(project.status).color,
                            fontWeight: 700, textTransform: 'uppercase'
                        }}>{getProjectStatusStyle(project.status).label}</span>
                        {(currentMember?.roleName || currentMember?.projectRoleName) && (
                            <span style={{
                                marginLeft: '8px', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px',
                                background: 'rgba(232, 114, 12, 0.1)', color: 'var(--accent-color)',
                                fontWeight: 700, textTransform: 'uppercase', border: '1px solid rgba(232, 114, 12, 0.2)'
                            }}>{currentMember?.roleName || currentMember?.projectRoleName}</span>
                        )}
                    </nav>
                </div>

                {/* Horizontal Navigation Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '24px',
                    marginBottom: '2rem',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '2px'
                }}>
                    {[
                        { id: 'home', label: 'Dashboard', icon: <Layout size={18} /> },
                        { id: 'tasks', label: 'Tasks', icon: <CheckCircle2 size={18} /> },
                        { id: 'milestones', label: 'Milestones', icon: <Target size={18} /> },
                        {
                            id: 'members',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Members
                                    {isSoloDirector && (
                                        <div
                                            className="pulse-alert"
                                            title="This project has no active Project Leader. Only the Lab Director is currently assigned."
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '16px',
                                                height: '16px',
                                                background: '#ef4444',
                                                color: 'white',
                                                borderRadius: '50%',
                                                fontSize: '10px',
                                                fontWeight: 900,
                                                cursor: 'help'
                                            }}>
                                            !
                                        </div>
                                    )}
                                </div>
                            ),
                            icon: <Users size={18} />
                        },
                        { id: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 4px',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid var(--primary-color)' : '2px solid transparent',
                                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: activeTab === tab.id ? 700 : 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <style>{`
                    .pulse-alert {
                        animation: pulse-red 1.5s infinite;
                        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                    }
                    @keyframes pulse-red {
                        0% {
                            transform: scale(0.95);
                            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                        }
                        70% {
                            transform: scale(1);
                            box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
                        }
                        100% {
                            transform: scale(0.95);
                            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
                        }
                    }
                `}</style>

                {/* Main Content Area */}
                <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {activeTab === 'home' && (
                            <DetailsHome
                                project={project}
                                tasks={tasks}
                                milestones={milestones}
                                formatProjectDate={formatProjectDate}
                                currentUser={currentUser}
                                currentMember={currentMember}
                                refreshData={fetchData}
                            />
                        )}

                        {activeTab === 'timeline' && (
                            <ProjectTimeline
                                project={project}
                                timelineData={timelineData}
                                onTaskClick={handleTaskClick}
                                onMilestoneClick={handleMilestoneClick}
                            />
                        )}

                        {activeTab === 'milestones' && (
                            <DetailsMilestones
                                projectId={id}
                                milestones={milestones}
                                filteredMilestones={filteredMilestones}
                                milestoneSearchQuery={milestoneSearchQuery}
                                setMilestoneSearchQuery={setMilestoneSearchQuery}
                                milestoneStatusFilter={milestoneStatusFilter}
                                setMilestoneStatusFilter={setMilestoneStatusFilter}
                                canManageMilestones={canManageMilestones}
                                isArchived={isArchived}
                                milestoneContainerRef={milestoneContainerRef}
                                handleMilestoneClick={handleMilestoneClick}
                                onDetailClick={handleMilestoneClick}
                                newMilestoneData={editingMilestoneId ? newMilestoneData : milestoneAddData}
                                handleMilestoneDataChange={handleMilestoneDataChange}
                                handleQuickMilestoneSave={handleQuickMilestoneSave}
                                checkOverlap={checkOverlap}
                                editingMilestoneId={editingMilestoneId}
                                onCancelEdit={handleCancelMilestoneEdit}
                                clearMilestoneEdit={() => setEditingMilestoneId(null)}
                                viewMode={milestoneViewMode}
                                activeMilestone={activeMilestoneForTasks}
                                refreshTasks={refetchTasks}
                                members={members}
                            />
                        )}

                        {activeTab === 'members' && (
                            <DetailsMembers
                                filteredMembers={filteredMembers}
                                memberSearchQuery={memberSearchQuery}
                                setMemberSearchQuery={setMemberSearchQuery}
                                canManageProject={canManageProject}
                                setIsAddMemberModalOpen={setIsAddMemberModalOpen}
                                setSelectedMember={setSelectedMember}
                                setIsMemberDetailModalOpen={setIsMemberDetailModalOpen}
                            />
                        )}

                        {activeTab === 'tasks' && (
                            <DetailsTasks
                                tasks={tasks}
                                filteredTasks={filteredTasks}
                                taskSearchQuery={taskSearchQuery}
                                setTaskSearchQuery={setTaskSearchQuery}
                                taskStatusFilter={taskStatusFilter}
                                setTaskStatusFilter={setTaskStatusFilter}
                                taskPriorityFilter={taskPriorityFilter}
                                setTaskPriorityFilter={setTaskPriorityFilter}
                                taskMilestoneFilter={taskMilestoneFilter}
                                setTaskMilestoneFilter={setTaskMilestoneFilter}
                                viewMode={taskView}
                                setViewMode={(mode) => setTaskView(mode as any)}
                                canManageTasks={canAddTask}
                                isArchived={isArchived}
                                setIsTaskModalOpen={setIsTaskModalOpen}
                                handleTaskClick={handleTaskClick}
                                newTasks={newTasks}
                                handleAddTaskForm={addInlineTask}
                                handleRemoveTaskForm={removeInlineTask}
                                handleNewTaskChange={updateInlineTask}
                                handleSaveNewTask={saveInlineTask}
                                milestones={milestones}
                                projectMembers={members}
                                project={project}
                                formatProjectDate={formatProjectDate}
                            />
                        )}

                        {activeTab === 'settings' && (
                            <DetailsSettings
                                isArchived={isArchived}
                                isReadOnly={isReadOnly}
                                isAdmin={isAdmin}
                                formData={formData}
                                handleStatusChange={(s: number) => { setPendingStatus(s as any); setIsStatusConfirmOpen(true); }}
                                handleInputChange={handleInputChange}
                                project={project}
                                availableFields={availableFields}
                                selectedFieldIds={selectedFieldIds}
                                toggleField={toggleField}
                                handleSubmit={handleSettingsSubmit}
                                submitting={submitting}
                                canDeleteProject={canDeleteProject}
                                setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <TaskFormModal
                isOpen={isTaskModalOpen}
                onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
                onSubmit={handleTaskSubmit}
                projectMembers={members}
                task={editingTask}
                milestones={milestones}
                projectId={id || ''}
                projectStartDate={project?.startDate || undefined}
                projectEndDate={project?.endDate || undefined}
                existingTasks={tasks}
            />

            <TaskDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                taskId={selectedTaskId}
                projectMembers={members}
                milestones={milestones}
                onTaskUpdated={refetchTasks}
                projectStartDate={project?.startDate || undefined}
                projectEndDate={project?.endDate || undefined}
            />


            <AddMemberModal
                isOpen={isAddMemberModalOpen}
                onClose={() => setIsAddMemberModalOpen(false)}
                projectId={id || ''}
                existingMemberIds={members.map(m => m.userId || m.id)}
                onSuccess={() => { refetchMembers(); }}
                hasLeader={members.some(m => Number(m.projectRole) === ProjectRoleEnum.Leader)}
                currentProjectRole={Number(projectRoleValue)}
            />

            <MemberDetailModal
                isOpen={isMemberDetailModalOpen}
                onClose={() => { setIsMemberDetailModalOpen(false); setSelectedMember(null); }}
                member={selectedMember}
                projectId={id || ''}
                currentUser={currentUser}
                currentUserProjectRole={Number(projectRoleValue)}
                canManage={canManageProject}
                onSuccess={() => { refetchMembers(); showToast('Team updated.'); }}
            />

            <Modal
                isOpen={isStatusConfirmOpen}
                onClose={() => setIsStatusConfirmOpen(false)}
                title="Update Status"
                variant="info"
                footer={(
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsStatusConfirmOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={confirmStatusChange}>Confirm</button>
                    </>
                )}
            >
                <p>Are you sure you want to change the project status to <strong>{ProjectStatus[pendingStatus || 0]}</strong>?</p>
            </Modal>

            <Modal
                isOpen={isDeleteConfirmOpen}
                onClose={() => { setIsDeleteConfirmOpen(false); setDeleteConfirmationInput(''); }}
                title="Delete Project"
                variant="danger"
                footer={(
                    <>
                        <button className="btn btn-secondary" onClick={() => { setIsDeleteConfirmOpen(false); setDeleteConfirmationInput(''); }}>Cancel</button>
                        <button
                            className="btn btn-danger"
                            onClick={handleDelete}
                            disabled={deleteConfirmationInput !== `${project?.projectName}/${members.find(m => m.userId === project?.createdBy)?.email || 'owner@labsync.com'}`}
                        >
                            Confirm Deletion
                        </button>
                    </>
                )}
            >
                <div style={{ padding: '0.5rem 0' }}>
                    <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                        This action is <strong>irreversible</strong>. To confirm, please type the project name and the owner's email separated by a slash:
                    </p>
                    <div style={{ background: 'var(--background-light)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                        <code style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {project?.projectName}/{members.find(m => m.userId === project?.createdBy)?.email || '[owner_email]'}
                        </code>
                    </div>
                    <input
                        className="form-input"
                        type="text"
                        placeholder="Type the confirmation string here"
                        value={deleteConfirmationInput}
                        onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                        style={{ borderColor: deleteConfirmationInput.length > 0 && deleteConfirmationInput !== `${project?.projectName}/${members.find(m => m.userId === project?.createdBy)?.email || 'owner@labsync.com'}` ? 'var(--error)' : '' }}
                    />
                </div>
            </Modal>
        </MainLayout>
    );
};

export default ProjectDetails;
