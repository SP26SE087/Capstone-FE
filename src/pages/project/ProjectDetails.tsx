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
    const [taskView, setTaskView] = useState<'list' | 'timeline'>('list');

    // Modals visibility
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
    const [milestoneViewMode, setMilestoneViewMode] = useState<'roadmap' | 'detail'>('roadmap');
    const [activeMilestoneForTasks, setActiveMilestoneForTasks] = useState<Milestone | null>(null);

    // Filters
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [taskStatusFilter, setTaskStatusFilter] = useState<string[]>([]);
    const [taskPriorityFilter, setTaskPriorityFilter] = useState<string[]>([]);
    const [taskMilestoneFilter, setTaskMilestoneFilter] = useState<string[]>([]);

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
    const [toast, setToast] = useState<{ message: string; type: ToastType; duration?: number } | null>(null);

    // Quick creation state
    const [newMilestoneData, setNewMilestoneData] = useState({ name: '', description: '', startDate: '', dueDate: '', status: 0 });
    const [milestoneAddData, setMilestoneAddData] = useState({ name: '', description: '', startDate: '', dueDate: '', status: 0 });
    const [newTasks, setNewTasks] = useState<any[]>([]);
    const [isMilestoneSaving, setIsMilestoneSaving] = useState(false);
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
                const mappedProject = {
                    ...projectData,
                    projectId: projectData.projectId || (projectData as any).id
                };
                setProject(mappedProject);
                setFormData({
                    projectName: mappedProject.projectName || (mappedProject as any).name || '',
                    projectDescription: mappedProject.projectDescription || (mappedProject as any).description || '',
                    startDate: !isDefaultDate(mappedProject.startDate) ? new Date(mappedProject.startDate!).toISOString().split('T')[0] : '',
                    endDate: !isDefaultDate(mappedProject.endDate) ? new Date(mappedProject.endDate!).toISOString().split('T')[0] : '',
                    status: mappedProject.status
                });
                setSelectedFieldIds(mappedProject.researchFields?.map(f => f.researchFieldId) || []);
            }

            // Fetch all required data in parallel without letting one fail the others
            console.log('ProjectDetails: Starting parallel fetch for workspace data...', { id });
            const fetchPromises = [
                milestoneService.getByProject(id),
                membershipService.getProjectMembers(id),
                researchFieldService.getAll(),
                taskService.getByProject(id),
                milestoneService.getMilestoneTasksByProject(id)
            ];

            const results = await Promise.all(
                fetchPromises.map((p, idx) => p.catch(e => { 
                    console.error(`Workspace fetch error [promise ${idx}]:`, e); 
                    return []; 
                }))
            );
            
            console.log('ProjectDetails: Parallel fetch results keys:', ['milestones', 'members', 'fields', 'tasks', 'timeline']);
            const [mRaw, membersRaw, fieldsRaw, tasksRaw, timelineRaw] = results;

            console.log('ProjectDetails: timelineRaw sample:', (timelineRaw as any)?.milestones?.[0] || timelineRaw?.[0] || 'empty');

            setMilestones(mRaw as Milestone[]);
            setMembers(membersRaw as any[]);
            setAvailableFields(fieldsRaw as ResearchField[]);
            setTasks(tasksRaw as Task[]);
            setTimelineData(timelineRaw);
            console.log('ProjectDetails: All data states updated.');
        } catch (error) {
            console.error('Failed to fetch project workspace data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        
        if (milestones.length > 0) {
            const lastDue = new Date(Math.max(...milestones.map(m => new Date(m.dueDate).getTime())));
            const nextStart = new Date(lastDue);
            nextStart.setDate(nextStart.getDate() + 1);
            const nextStartStr = nextStart.toISOString().split('T')[0];
            
            // Use tomorrow of the last milestone, but not earlier than today
            const finalStartStr = new Date(nextStartStr) < new Date(today) ? today : nextStartStr;
            
            setMilestoneAddData(prev => prev.startDate ? prev : { ...prev, startDate: finalStartStr });
        } else if (project?.startDate) {
            const pStart = new Date(project.startDate).toISOString().split('T')[0];
            const finalStartStr = new Date(pStart) < new Date(today) ? today : pStart;
            setMilestoneAddData(prev => prev.startDate ? prev : { ...prev, startDate: finalStartStr });
        }
    }, [milestones, project?.startDate]);

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
            const list = milestonesData || [];
            setMilestones(list);

            // Synchronize active milestone if currently viewing details
            if (activeMilestoneForTasks) {
                const refreshed = list.find(m => (m.milestoneId === activeMilestoneForTasks.milestoneId || (m as any).id === activeMilestoneForTasks.milestoneId));
                if (refreshed) {
                    setActiveMilestoneForTasks(refreshed);
                }
            }
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
        setEditingTask(task);
        setIsTaskModalOpen(true);
    };

    const handleMilestoneClick = (milestone: Milestone | null) => {
        const mId = milestone?.milestoneId || (milestone as any)?.id;
        if (!milestone || !mId) {
            // If just entering detail view without a specific milestone (e.g., from Add mode trigger)
            setMilestoneViewMode('detail');
            setEditingMilestoneId(null);
            return;
        }
        setEditingMilestoneId(mId);
        setNewMilestoneData({
            name: milestone.name,
            description: milestone.description || '',
            startDate: milestone.startDate ? new Date(milestone.startDate).toISOString().split('T')[0] : '',
            dueDate: milestone.dueDate ? new Date(milestone.dueDate).toISOString().split('T')[0] : '',
            status: milestone.status
        });
        // Automatically show tasks for this milestone
        setActiveMilestoneForTasks({ ...milestone, milestoneId: mId });
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
        setSubmitting(true);
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
        } catch (error: any) {
            console.error('Failed to save task:', error);
            showToast(error.message || 'Failed to save task.', 'error');
        } finally {
            setSubmitting(false);
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
        if (!dataToSave.name?.trim()) {
            showToast('Milestone name is required.', 'warning');
            return;
        }
        if (!dataToSave.startDate || !dataToSave.dueDate) {
            showToast('Both start and due dates are required.', 'warning');
            return;
        }

        if (!dataToSave.name || !id) return;

        if (checkOverlap(dataToSave.startDate, dataToSave.dueDate)) {
            showToast('This timeframe overlaps with another existing milestone.', 'warning');
            return;
        }

        setIsMilestoneSaving(true);
        try {
            if (editingMilestoneId) {
                // DIFFERENTIAL UPDATE: Only send dates if they changed
                const updatePayload: any = { ...dataToSave, projectId: id };
                
                if (activeMilestoneForTasks) {
                    const originalStart = activeMilestoneForTasks.startDate ? new Date(activeMilestoneForTasks.startDate).toISOString().split('T')[0] : '';
                    const originalDue = activeMilestoneForTasks.dueDate ? new Date(activeMilestoneForTasks.dueDate).toISOString().split('T')[0] : '';
                    
                    if (dataToSave.startDate === originalStart) delete updatePayload.startDate;
                    if (dataToSave.dueDate === originalDue) delete updatePayload.dueDate;
                }
                
                await milestoneService.update(editingMilestoneId, updatePayload);
                showToast('Milestone updated!', 'success');
                // Stay in detail view, but switch form to view mode
                setMilestoneViewMode('detail'); 
                // We'll update activeMilestone for tasks to reflect changes
                if (activeMilestoneForTasks) {
                    setActiveMilestoneForTasks({ ...activeMilestoneForTasks, ...dataToSave });
                }
            } else {
                await milestoneService.create({ ...dataToSave, projectId: id });
                showToast('Milestone created!', 'success');
                
                // After successful creation, RESET and STAY in roadmap view (as requested)
                setMilestoneAddData({ name: '', description: '', startDate: '', dueDate: '', status: 0 });
                setMilestoneViewMode('roadmap'); 
                setEditingMilestoneId(null);
                setActiveMilestoneForTasks(null);
            }
            // Refetch list
            await refetchMilestones();
        } catch (error) {
            showToast(`Failed to ${editingMilestoneId ? 'update' : 'create'} milestone.`, 'error');
        } finally {
            setIsMilestoneSaving(false);
        }
    };

    // Inline Task Handlers
    const addInlineTask = () => {
        setNewTasks([{ 
            tempId: `temp-${Date.now()}`, 
            name: '', 
            description: '', 
            milestoneId: '', 
            assigneeId: '', 
            priority: 2, 
            startDate: '', 
            endDate: '',
            supportMemberIds: []
        }]);
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

        setSubmitting(true);
        try {
            await taskService.create({
                name: t.name,
                description: t.description || null,
                priority: t.priority || 2,
                milestoneId: milestones.find(m => m.milestoneId === t.milestoneId || m.name === t.milestoneId)?.milestoneId || t.milestoneId || null,
                memberId: t.assigneeId || null,
                startDate: t.startDate ? new Date(t.startDate).toISOString() : null,
                dueDate: new Date(t.endDate).toISOString(),
                supportMembers: t.supportMemberIds || [],
                projectId: id
            });
            showToast('Task created successfully!', 'success');
            removeInlineTask(id_temp);
            await refetchTasks();
        } catch (error) {
            console.error('Failed to create task:', error);
            showToast((error as any).message || 'Failed to create task.', 'error');
        } finally {
            setSubmitting(false);
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
        } catch (error: any) {
            showToast(error.message || 'Failed to update project.', 'error');
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
            } catch (error: any) {
                showToast(error.message || 'Failed to update status.', 'error');
            }
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        try {
            await projectService.delete(id);
            navigate('/projects');
        } catch (error: any) {
            showToast(error.message || 'Failed to delete project.', 'error');
        }
    };

    // Role calculations
    const projectRoleValue = currentMember?.projectRole || project?.projectRole;
    const isAdmin = currentUser.role === 'Admin';
    const canManageProject = isAdmin || (Number(projectRoleValue) === ProjectRoleEnum.Leader) || (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);
    const canManageMilestones = isAdmin || (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);
    const canAddTask = isAdmin || [ProjectRoleEnum.Leader, ProjectRoleEnum.LabDirector].includes(Number(projectRoleValue));
    const isArchived = project?.status === ProjectStatus.Archived;
    const isReadOnly = (isArchived && !isAdmin) || !canManageProject;
    const canDeleteProject = isAdmin || (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);

    // Filtered data
    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(taskSearchQuery.toLowerCase());
        const matchesStatus = taskStatusFilter.length === 0 || taskStatusFilter.includes('all') || taskStatusFilter.includes(t.status.toString());
        const matchesPriority = taskPriorityFilter.length === 0 || taskPriorityFilter.includes('all') || taskPriorityFilter.includes(t.priority.toString());
        const matchesMilestone = taskMilestoneFilter.length === 0 || taskMilestoneFilter.includes('all') || taskMilestoneFilter.includes(t.milestoneId || 'ungrouped');
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
            {toast && (
                <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999 }}>
                    <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => setToast(null)} />
                </div>
            )}

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
                <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'stretch', minHeight: 'calc(100vh - 200px)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {activeTab === 'home' && (
                            <DetailsHome
                                project={project}
                                tasks={tasks}
                                milestones={milestones}
                                timelineData={timelineData}
                                members={members}
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
                                canManageProject={canManageProject}
                                isArchived={isArchived}
                                milestoneContainerRef={milestoneContainerRef}
                                handleMilestoneClick={handleMilestoneClick}
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
                                refreshMilestones={refetchMilestones}
                                showToast={showToast}
                                members={members}
                                projectStartDate={project.startDate}
                                projectEndDate={project.endDate}
                                isMilestoneSaving={isMilestoneSaving}
                            />
                        )}

                        {activeTab === 'members' && (
                            <DetailsMembers
                                filteredMembers={filteredMembers}
                                memberSearchQuery={memberSearchQuery}
                                setMemberSearchQuery={setMemberSearchQuery}
                                canManageProject={canManageProject}
                                projectId={id || ''}
                                hasLeader={members.some(m => Number(m.projectRole) === ProjectRoleEnum.Leader)}
                                existingMemberIds={members.map(m => m.email).filter(Boolean)}
                                currentProjectRole={Number(projectRoleValue)}
                                currentUser={currentUser}
                                onMemberAdded={refetchMembers}
                                onMemberUpdated={() => { refetchMembers(); showToast('Team updated.'); }}
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
                                isArchived={project.status === ProjectStatus.Archived}
                                newTasks={newTasks}
                                handleAddTaskForm={addInlineTask}
                                handleRemoveTaskForm={removeInlineTask}
                                handleNewTaskChange={updateInlineTask}
                                handleSaveNewTask={saveInlineTask}
                                milestones={milestones}
                                projectMembers={members}
                                project={project}
                                formatProjectDate={formatProjectDate}
                                currentUser={currentUser}
                                currentMember={currentMember}
                                refreshTasks={refetchTasks}
                                onEditTask={(task) => { setEditingTask(task); setIsTaskModalOpen(true); }}
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
                submitting={submitting}
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
                onClose={() => setIsDeleteConfirmOpen(false)}
                title="Delete Project"
                variant="danger"
                footer={(
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</button>
                        <button className="btn btn-danger" onClick={handleDelete}>Delete Project</button>
                    </>
                )}
            >
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{project?.projectName}</strong>? This will permanently remove the project along with all its tasks, milestones, and member data. This action cannot be undone.
                </p>
            </Modal>
        </MainLayout>
    );
};

export default ProjectDetails;
