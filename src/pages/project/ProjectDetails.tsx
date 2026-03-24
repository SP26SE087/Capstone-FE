import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { projectService, milestoneService, membershipService, taskService, researchFieldService } from '@/services';
import ProjectSidebar from '@/components/navigation/ProjectSidebar';
import { Project, ProjectStatus, Milestone, MilestoneStatus, Task, TaskStatus, ResearchField } from '@/types';
import { getProjectStatusStyle, isDefaultDate, formatProjectDate, toApiDate } from '@/utils/projectUtils';
import Modal from '@/components/common/Modal';
import Toast, { ToastType } from '@/components/common/Toast';
import { useAuth } from '@/hooks/useAuth';

import {
    Users,
    UserPlus,
    Settings,
    AlertCircle,
    Clock,
    ShieldAlert,
    Plus,
    Activity,
    ArrowLeft,
    Save,
    FileText,
    Briefcase,
    Check,
    Trash2,
    ChevronDown,
    CheckCircle2,
    Flag,
    Calendar,
    User,
    Search,
    Filter,
    X
} from 'lucide-react';
import { ProjectRoleEnum } from '@/types/project';
import MilestoneItem from '@/components/milestone/MilestoneItem';
import TaskItem from '@/components/task/TaskItem';
import KanbanBoard from '@/features/tasks/KanbanBoard';
import TaskFormModal from '@/features/tasks/TaskFormModal';
import TaskDetailModal from '@/features/tasks/TaskDetailModal';
import MilestoneFormModal from '@/features/milestones/MilestoneFormModal';
import MilestoneDetailModal from '@/features/milestones/MilestoneDetailModal';
import AddMemberModal from '@/features/projects/AddMemberModal';
import MemberDetailModal from '@/features/projects/MemberDetailModal';
import ProjectTimeline from '@/features/projects/ProjectTimeline';
import TaskRoadmapPreview from '@/features/tasks/TaskRoadmapPreview';
import SearchableSelect from '@/components/common/SearchableSelect';

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
    const [taskView, setTaskView] = useState<'list' | 'board'>('list');
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
    const [isMilestoneDetailOpen, setIsMilestoneDetailOpen] = useState(false);
    const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
    const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [isMemberDeleteConfirmOpen, setIsMemberDeleteConfirmOpen] = useState(false);
    const [selectedMemberForDelete, setSelectedMemberForDelete] = useState<any>(null);
    const [isMemberDetailModalOpen, setIsMemberDetailModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<any>(null);

    // ─── Task Search & Filter State ──────────────────────────────────────────
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [taskStatusFilters, setTaskStatusFilters] = useState<string[]>([]);
    const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('all');
    const [taskMilestoneFilters, setTaskMilestoneFilters] = useState<string[]>([]);
    const [taskStartDateFilter, setTaskStartDateFilter] = useState<string>('');
    const [taskEndDateFilter, setTaskEndDateFilter] = useState<string>('');
    const [showMyTasks, setShowMyTasks] = useState(true);
    const [showTaskFilters, setShowTaskFilters] = useState(false);

    // ─── Milestone Search & Filter State ──────────────────────────────────────
    const [milestoneSearchQuery, setMilestoneSearchQuery] = useState('');
    const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<string>('all');

    // ─── Member Search State ──────────────────────────────────────────────────
    const [memberSearchQuery, setMemberSearchQuery] = useState('');

    // ─── Configuration (Settings) State ───────────────────────────────────────
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
    const [quickAddMilestones, setQuickAddMilestones] = useState<any[]>([]);
    const [newTasks, setNewTasks] = useState<any[]>([]);
    const [activeTaskDraftId, setActiveTaskDraftId] = useState<string | null>(null);
    const [isDraftQueueOpen, setIsDraftQueueOpen] = useState(false);
    const [showDraftDropdown, setShowDraftDropdown] = useState(false);
    const milestoneContainerRef = useRef<HTMLDivElement>(null);

    const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
        setToast({ message, type, duration });
    };
    // ──────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const memberInfo = await projectService.getCurrentMember(id);
                console.log("Current Member Info:", memberInfo);

                if (!memberInfo || !memberInfo.projectRole) {
                    navigate(`/explore/projects/${id}`, { replace: true });
                    return;
                }

                setCurrentMember(memberInfo);
                const memberId = memberInfo?.memberId || memberInfo?.id;

                // Fetch tasks first as requested
                if (showMyTasks && memberId) {
                    const myTasks = await taskService.getTaskByMember(memberId);
                    setTasks(myTasks || []);
                } else {
                    const allTasks = await taskService.getByProject(id);
                    setTasks(allTasks || []);
                }

                const projectData = await projectService.getById(id);

                if (!projectData) {
                    setProject(null);
                    setLoading(false);
                    return;
                }

                setProject(projectData);

                // Sync form data for settings tab
                setFormData({
                    projectName: projectData.projectName || (projectData as any).name || '',
                    projectDescription: projectData.projectDescription || (projectData as any).description || '',
                    startDate: !isDefaultDate(projectData.startDate) ? new Date(projectData.startDate!).toISOString().split('T')[0] : '',
                    endDate: !isDefaultDate(projectData.endDate) ? new Date(projectData.endDate!).toISOString().split('T')[0] : '',
                    status: projectData.status
                });
                setSelectedFieldIds(projectData.researchFields?.map(f => f.id) || []);

                const [milestonesData, membersData, fieldsData, timelineResponse] = await Promise.all([
                    milestoneService.getByProject(id),
                    membershipService.getProjectMembers(id),
                    researchFieldService.getAll(),
                    projectService.getMilestoneTasks(id)
                ]);

                setMilestones(milestonesData.length ? milestonesData : (projectData.milestones || []));
                setMembers(membersData.length ? membersData : (projectData.members || []));
                setAvailableFields(fieldsData);
                setTimelineData(timelineResponse);
            } catch (error) {
                console.error('Failed to fetch project workspace data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, navigate]);

    const refetchTasks = async () => {
        if (!id || loading) return; // Don't run if still in initial load
        try {
            let tasksData;
            const memberId = currentMember?.memberId || currentMember?.id;

            if (showMyTasks && memberId) {
                tasksData = await taskService.getTaskByMember(memberId);
            } else {
                tasksData = await taskService.getByProject(id);
            }
            setTasks(tasksData || []);
        } catch (error) {
            console.error('Failed to refetch tasks:', error);
        }
    };

    useEffect(() => {
        if (activeTab === 'tasks') {
            refetchTasks();
        }
        if (activeTab === 'timeline' && id) {
            projectService.getMilestoneTasks(id).then(setTimelineData);
        }
    }, [showMyTasks, activeTab]);

    const refetchMilestones = async () => {
        if (!id) return;
        try {
            const milestonesData = await milestoneService.getByProject(id);
            setMilestones(milestonesData);
        } catch (error) {
            console.error('Failed to refetch milestones:', error);
        }
    };

    const refetchMembers = async () => {
        if (!id) return;
        try {
            const membersData = await membershipService.getProjectMembers(id);
            setMembers(membersData);
        } catch (error) {
            console.error('Failed to refetch members:', error);
        }
    };

    const handleRemoveMember = async () => {
        if (!id || !selectedMemberForDelete) return;
        try {
            const memberId = selectedMemberForDelete.id || selectedMemberForDelete.memberId;
            await membershipService.removeMember(id, memberId);
            showToast('Member removed from project.', 'success');
            await refetchMembers();
            setIsMemberDeleteConfirmOpen(false);
            setSelectedMemberForDelete(null);
        } catch (error) {
            console.error('Failed to remove member:', error);
            showToast('Failed to remove member.', 'error');
        }
    };

    const handleMilestoneSubmit = async (milestoneData: any | any[]) => {
        try {
            if (editingMilestone) {
                // milestoneData is a single object from Edit mode
                await milestoneService.update(editingMilestone.id, { ...milestoneData, projectId: id });
                showToast('Milestone updated successfully!', 'success');
            } else {
                // milestoneData is an array of objects from Bulk Create mode
                const bulkData = milestoneData.map((m: any) => ({ ...m, projectId: id }));
                const response = await milestoneService.createBulk(bulkData);

                // Handle partial success in bulk creation
                if (response && response.data && Array.isArray(response.data)) {
                    const totalCount = response.data.length;
                    const successItems = response.data.filter((item: any) => item.success);
                    const successCount = successItems.length;
                    const failCount = totalCount - successCount;

                    if (failCount > 0) {
                        const failedNames = response.data
                            .filter((item: any) => !item.success)
                            .map((item: any) => item.request?.name || `Item ${item.index + 1}`)
                            .join(', ');

                        const firstError = response.data.find((item: any) => !item.success)?.errorMessage;

                        if (successCount > 0) {
                            showToast(`${successCount}/${totalCount} phases created. Failed: [${failedNames}]. Error: ${firstError || 'Format error'}`, 'warning', 8000);
                        } else {
                            showToast(`Failed to create phases: [${failedNames}]. Error: ${firstError || 'Server error'}`, 'error', 8000);
                        }
                    } else {
                        showToast(`${successCount} phases created successfully!`, 'success');
                    }
                } else {
                    showToast(`${milestoneData.length} phases created successfully!`, 'success');
                }
            }
            await refetchMilestones();
            setIsMilestoneModalOpen(false);
            setEditingMilestone(null);
        } catch (error) {
            console.error('Failed to save milestone:', error);
            showToast('Failed to save milestones.', 'error');
        }
    };

    const handleMilestoneClick = (milestone: Milestone) => {
        setSelectedMilestoneId(milestone.id);
        setIsMilestoneDetailOpen(true);
    };


    const handleTaskClick = (task: Task) => {
        setSelectedTaskId(task.id);
        setIsDetailModalOpen(true);
    };

    const handleTaskSubmit = async (taskData: any | any[]) => {
        try {
            if (editingTask) {
                // taskData is a single object from Edit mode
                const result = await taskService.update(editingTask.id, { ...taskData, projectId: id });
                if (result?._partialError) {
                    showToast(result._partialError, 'warning');
                } else {
                    showToast('Research activity updated successfully!', 'success');
                }
            } else if (Array.isArray(taskData)) {
                // taskData is an array of objects from Bulk Create mode
                const bulkData = taskData.map((t: any) => ({ ...t, projectId: id }));
                const response = await taskService.createBulk(bulkData);

                // Handle partial success in bulk creation
                if (response && response.data && Array.isArray(response.data)) {
                    const totalCount = response.data.length;
                    const successCount = response.data.filter((item: any) => item.success).length;
                    const failCount = totalCount - successCount;

                    if (failCount > 0) {
                        const failedNames = response.data
                            .filter((item: any) => !item.success)
                            .map((item: any) => item.request?.name || `Item ${item.index + 1}`)
                            .join(', ');

                        const firstError = response.data.find((item: any) => !item.success)?.errorMessage;

                        if (successCount > 0) {
                            showToast(`${successCount}/${totalCount} tasks created. Failed: [${failedNames}]. Error: ${firstError || 'Format error'}`, 'warning', 8000);
                        } else {
                            showToast(`Failed to create research activities: [${failedNames}]. Error: ${firstError || 'Server error'}`, 'error', 8000);
                        }
                    } else {
                        showToast(`${successCount} research activities registered successfully!`, 'success');
                    }
                } else {
                    showToast(`${taskData.length} research activities registered successfully!`, 'success');
                }
            } else {
                // taskData is a single object
                const result = await taskService.create({ ...taskData, projectId: id });
                if (result?._partialError) {
                    showToast(result._partialError, 'warning');
                } else {
                    showToast('Research activity registered successfully!', 'success');
                }
            }
            await refetchTasks();
            setIsTaskModalOpen(false);
            setEditingTask(null);
        } catch (error) {
            console.error('Failed to save task:', error);
            showToast('Failed to save research activity.', 'error');
        }
    };

    // Quick Add Milestone Handlers
    const handleAddQuickMilestone = () => {
        // Find the latest end date among existing and quick milestones
        let latestDate = '';

        // Check existing milestones
        if (milestones.length > 0) {
            const sorted = [...milestones].sort((a, b) => {
                const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                return dateB - dateA;
            });
            if (sorted[0].dueDate) {
                latestDate = sorted[0].dueDate.split('T')[0];
            }
        }

        // If there are already quick milestones, use the latest one's end date
        if (quickAddMilestones.length > 0) {
            const lastQuick = quickAddMilestones[quickAddMilestones.length - 1];
            if (lastQuick.dueDate) {
                latestDate = lastQuick.dueDate;
            }
        }

        setQuickAddMilestones(prev => [
            ...prev,
            {
                name: '',
                description: '',
                startDate: latestDate,
                dueDate: '',
                status: MilestoneStatus.NotStarted,
                projectId: id,
                tempId: Date.now() + Math.random()
            }
        ]);

        // Scroll to the bottom of the container
        setTimeout(() => {
            if (milestoneContainerRef.current) {
                milestoneContainerRef.current.scrollTo({
                    top: milestoneContainerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }, 100);
    };

    const handleQuickMilestoneChange = (tempId: number, field: string, value: any) => {
        setQuickAddMilestones(prev => prev.map(m =>
            m.tempId === tempId ? { ...m, [field]: value } : m
        ));
    };

    const handleRemoveQuickForm = (tempId: number) => {
        setQuickAddMilestones(prev => prev.filter(m => m.tempId !== tempId));
    };

    const handleQuickMilestoneSave = async (tempId: number) => {
        const milestoneToSave = quickAddMilestones.find(m => m.tempId === tempId);
        if (!milestoneToSave) return;

        if (!milestoneToSave.name) {
            showToast('Please name the research phase.', 'error');
            return;
        }

        try {
            // Prepare data with correct ISO date format as required by the backend
            const dataToSave = {
                ...milestoneToSave,
                startDate: new Date(milestoneToSave.startDate).toISOString(),
                dueDate: milestoneToSave.dueDate ? new Date(milestoneToSave.dueDate).toISOString() : null
            };

            await milestoneService.create(dataToSave);
            showToast('Research phase created successfully.', 'success');
            setQuickAddMilestones(prev => prev.filter(m => m.tempId !== tempId));
            await refetchMilestones();
        } catch (error) {
            console.error('Failed to create milestone:', error);
            showToast('Failed to create research phase.', 'error');
        }
    };

    // ─── Inline Task Handlers ──────────────────────────────────────────────
    const addInlineTask = () => {
        const newId = `new-${Date.now()}-${Math.random()}`;
        setNewTasks(prev => [
            ...prev,
            {
                id: newId,
                name: '',
                description: '',
                startDate: new Date().toISOString().split('T')[0],
                dueDate: '',
                priority: 2, // Medium
                milestoneId: '',
                memberIds: [],
                collaboratorIds: [],
                status: TaskStatus.Todo
            }
        ]);
        setActiveTaskDraftId(newId);
        setIsDraftQueueOpen(true);
    };

    const updateInlineTask = (draftId: string, field: string, value: any) => {
        setNewTasks(prev => prev.map(t => t.id === draftId ? { ...t, [field]: value } : t));
    };

    const removeInlineTask = (draftId: string) => {
        setNewTasks(prev => {
            const filtered = prev.filter(t => t.id !== draftId);
            if (activeTaskDraftId === draftId) {
                setActiveTaskDraftId(filtered.length > 0 ? filtered[filtered.length - 1].id : null);
            }
            return filtered;
        });
    };

    const saveInlineTask = async (draftId: string) => {
        const row = newTasks.find(t => t.id === draftId);
        if (!row) return;

        if (!row.name || !row.startDate || !row.dueDate) {
            showToast('Please fill in activity name and dates.', 'error');
            return;
        }

        try {
            const dataToSave = {
                name: row.name,
                description: row.description,
                startDate: new Date(row.startDate).toISOString(),
                dueDate: new Date(row.dueDate).toISOString(),
                priority: Number(row.priority),
                status: Number(row.status),
                milestoneId: row.milestoneId || null,
                memberId: row.memberIds[0] || null, // Primary assignee
                supportMembers: [...row.memberIds.slice(1), ...(row.collaboratorIds || [])], // Rest + collaborators
                projectId: id // From useParams
            };

            await taskService.create(dataToSave);
            showToast('Research activity registered successfully!', 'success');

            setNewTasks(prev => {
                const filtered = prev.filter(t => t.id !== draftId);
                if (activeTaskDraftId === draftId) {
                    setActiveTaskDraftId(filtered.length > 0 ? filtered[filtered.length - 1].id : null);
                }
                return filtered;
            });
            await refetchTasks();
        } catch (error) {
            console.error('Failed to register research activity:', error);
            showToast('Failed to register research activity.', 'error');
        }
    };

    const saveAllInlineTasks = async () => {
        const validTasks = newTasks.filter(t => t.name && t.startDate && t.dueDate);
        if (validTasks.length === 0) {
            showToast('No valid complete tasks to save. Ensure all fields are filled.', 'warning');
            return;
        }

        setSubmitting(true);
        let successCount = 0;
        let failCount = 0;

        for (const row of validTasks) {
            try {
                const dataToSave = {
                    name: row.name,
                    description: row.description,
                    startDate: new Date(row.startDate).toISOString(),
                    dueDate: new Date(row.dueDate).toISOString(),
                    priority: Number(row.priority),
                    status: Number(row.status),
                    milestoneId: row.milestoneId || null,
                    memberId: row.memberIds[0] || null,
                    supportMembers: [...row.memberIds.slice(1), ...(row.collaboratorIds || [])],
                    projectId: id
                };
                await taskService.create(dataToSave);
                successCount++;
            } catch {
                failCount++;
            }
        }

        setSubmitting(false);
        if (successCount > 0) {
            showToast(`Successfully registered ${successCount} activities!`, 'success');
            setNewTasks(prev => prev.filter(t => !validTasks.some(vt => vt.id === t.id)));
            if (validTasks.some(vt => vt.id === activeTaskDraftId)) {
                setActiveTaskDraftId(null);
            }
            await refetchTasks();
        }
        if (failCount > 0) {
            showToast(`Failed to register ${failCount} activities.`, 'error');
        }
    };

    const checkOverlap = (startDate: string, dueDate: string) => {
        if (!startDate || !dueDate) return false;

        // Normalize dates to YYYY-MM-DD for consistent comparison
        const s = startDate.split('T')[0];
        const e = dueDate.split('T')[0];

        const isOverlap = (s1: string, e1: string, s2: string, e2: string) => {
            // Returns true if there is any intersection between [s1, e1] and [s2, e2]
            return s1 <= e2 && e1 >= s2;
        };

        // ONLY check against existing (saved) milestones as per user request
        return milestones.some(m => {
            if (!m.startDate || !m.dueDate || m.startDate.startsWith('0001')) return false;
            const ms = m.startDate.split('T')[0];
            const me = m.dueDate.split('T')[0];
            return isOverlap(s, e, ms, me);
        });
    };



    const projectRoleValue = currentMember?.projectRole || project?.projectRole;
    const isAdmin = currentUser.role === 'Admin';
    const canManageProject = isAdmin ||
        (Number(projectRoleValue) === ProjectRoleEnum.Leader) ||
        (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);
    const canDeleteProject = isAdmin || (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);
    const canManageMilestones = isAdmin || (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);
    const canAddTask = isAdmin ||
        [ProjectRoleEnum.Leader, ProjectRoleEnum.LabDirector, ProjectRoleEnum.SeniorResearcher].includes(Number(projectRoleValue));
    const isArchived = project?.status === ProjectStatus.Archived;
    const isReadOnly = (isArchived && !isAdmin) || !canManageProject;
    const hasLeader = members.some(m =>
        Number(m.projectRole) === ProjectRoleEnum.Leader ||
        m.roleName === 'Leader' ||
        m.projectRoleName === 'Leader'
    );

    const filteredMembers = members.filter(m => {
        const query = memberSearchQuery.toLowerCase();
        return (m.fullName || m.userName || '').toLowerCase().includes(query) ||
            (m.email || '').toLowerCase().includes(query) ||
            (m.roleName || m.projectRoleName || '').toLowerCase().includes(query);
    });

    // ─── Configuration Handlers ────────────────────────────────────────────────
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const isValidTransition = (currentStatus: ProjectStatus, newStatus: ProjectStatus): boolean => {
        switch (currentStatus) {
            case ProjectStatus.Active: return [ProjectStatus.Inactive, ProjectStatus.Completed, ProjectStatus.Archived].includes(newStatus);
            case ProjectStatus.Inactive: return [ProjectStatus.Active, ProjectStatus.Archived].includes(newStatus);
            case ProjectStatus.Completed: return newStatus === ProjectStatus.Archived;
            case ProjectStatus.Archived: return newStatus === ProjectStatus.Active;
            default: return false;
        }
    };

    const handleStatusChange = (newStatus: number) => {
        if (!project) return;
        const nextStatus = newStatus as ProjectStatus;
        if (isReadOnly && !isAdmin) { showToast('You do not have permission to change the status.', 'error'); return; }
        if (!isValidTransition(project.status, nextStatus)) { showToast(`Cannot transition from ${ProjectStatus[project.status]} to ${ProjectStatus[nextStatus]}.`, 'error'); return; }
        setPendingStatus(nextStatus);
        setIsStatusConfirmOpen(true);
    };

    const confirmStatusChange = async () => {
        if (pendingStatus !== null && id) {
            try {
                await projectService.updateStatus(id, pendingStatus);
                setFormData(prev => ({ ...prev, status: pendingStatus }));
                setProject(prev => prev ? { ...prev, status: pendingStatus } : prev);
                setIsStatusConfirmOpen(false);
                showToast(`Project status updated to ${ProjectStatus[pendingStatus]}`, 'success');
            } catch {
                showToast('An error occurred while updating the status.', 'error');
            }
        }
    };

    const toggleField = (fieldId: string) => {
        setSelectedFieldIds(prev =>
            prev.includes(fieldId) ? prev.filter(x => x !== fieldId) : [...prev, fieldId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || isReadOnly) return;
        setSubmitting(true);
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const updateData = {
                projectId: id,
                projectName: formData.projectName,
                projectDescription: formData.projectDescription,
                startDate: toApiDate(formData.startDate || todayStr),
                endDate: toApiDate(formData.endDate),
                researchFieldIds: selectedFieldIds
            };
            await projectService.update(updateData);
            showToast('Project details updated successfully!', 'success');
            const updated = await projectService.getById(id);
            if (updated) setProject(updated);
        } catch {
            showToast('Failed to update project details.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        try {
            await projectService.delete(id);
            showToast('Project deleted successfully.', 'info');
            setTimeout(() => navigate('/projects'), 1000);
        } catch {
            showToast('Failed to delete project.', 'error');
        } finally {
            setIsDeleteConfirmOpen(false);
        }
    };
    // ──────────────────────────────────────────────────────────────────────────

    const getStatusStyle = (status: ProjectStatus) => getProjectStatusStyle(status);

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.name.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
            (task.description?.toLowerCase().includes(taskSearchQuery.toLowerCase()) || false);
        const matchesStatus = taskStatusFilters.length === 0 || taskStatusFilters.includes(task.status.toString());
        const matchesPriority = taskPriorityFilter === 'all' || task.priority.toString() === taskPriorityFilter;
        const matchesMilestone = taskMilestoneFilters.length === 0 ||
            taskMilestoneFilters.includes(task.milestoneId || '');

        // Date filtering (by due date)
        let matchesDate = true;
        if (task.dueDate) {
            const taskDate = new Date(task.dueDate).getTime();
            if (taskStartDateFilter && taskDate < new Date(taskStartDateFilter).getTime()) matchesDate = false;
            if (taskEndDateFilter && taskDate > new Date(taskEndDateFilter).getTime()) matchesDate = false;
        } else if (taskStartDateFilter || taskEndDateFilter) {
            matchesDate = false; // Tasks without due date don't match date range
        }

        return matchesSearch && matchesStatus && matchesPriority && matchesMilestone && matchesDate;
    });

    const filteredMilestones = milestones
        .filter(m => {
            const matchesSearch = (m.name || '').toLowerCase().includes(milestoneSearchQuery.toLowerCase()) ||
                (m.description || '').toLowerCase().includes(milestoneSearchQuery.toLowerCase());

            if (milestoneStatusFilter === 'all') {
                // Default view: Todo, In Progress, Completed
                return matchesSearch && [MilestoneStatus.NotStarted, MilestoneStatus.InProgress, MilestoneStatus.Completed].includes(m.status);
            }
            return matchesSearch && m.status.toString() === milestoneStatusFilter;
        })
        .sort((a, b) => {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            return dateA - dateB;
        });

    // Auto-scroll to current milestone
    useEffect(() => {
        if (activeTab === 'milestones' && filteredMilestones.length > 0) {
            // Priority 1: First InProgress milestone
            const inProgress = filteredMilestones.filter(m => m.status === MilestoneStatus.InProgress);
            let targetId: string | null = null;

            if (inProgress.length > 0) {
                targetId = inProgress[0].id; // Already sorted by dueDate in filtreredMilestones
            } else {
                // Priority 2: Last Completed milestone
                const completed = filteredMilestones.filter(m => m.status === MilestoneStatus.Completed);
                if (completed.length > 0) {
                    targetId = completed[completed.length - 1].id;
                }
            }

            if (targetId) {
                setTimeout(() => {
                    const element = document.getElementById(`milestone-item-${targetId}`);
                    const container = milestoneContainerRef.current;
                    if (element && container) {
                        const targetScrollPos = element.offsetTop - (container.offsetHeight / 2) + (element.offsetHeight / 2);
                        container.scrollTo({
                            top: Math.max(0, targetScrollPos),
                            behavior: 'smooth'
                        });
                    }
                }, 100);
            }
        }
    }, [activeTab, filteredMilestones.length]);

    if (loading) {
        return (
            <MainLayout
                role={currentUser.role}
                userName={currentUser.name}
                customSidebar={<ProjectSidebar projectId={id || ''} projectName={project?.projectName || location.state?.projectName || 'Project Workspace'} activeTab={activeTab} onTabChange={setActiveTab} roleName={currentMember?.roleName} />}
            >
                <div style={{ padding: '0' }}>
                    <div style={{ background: 'white', borderBottom: '1px solid var(--border-color)', padding: '1.5rem 2rem', margin: '-1.5rem -2rem 2rem', opacity: 0.7 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#f1f5f9' }}></div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#e2e8f0' }}>{location.state?.projectName || 'Loading Project...'}</h1>
                                <div style={{ height: '16px', width: '150px', background: '#f8fafc', marginTop: '8px' }}></div>
                            </div>
                        </div>
                    </div>
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <div className="loader" style={{ margin: '0 auto' }}></div>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (!project) {
        return (
            <MainLayout role="Researcher" userName="Current User">
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
                    <h2>Project Not Found</h2>
                    <p>The project workspace you're looking for doesn't exist or you don't have access.</p>
                    <button onClick={() => navigate('/projects')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        Back to Projects
                    </button>
                </div>
            </MainLayout>
        );
    }


    return (
        <MainLayout
            role={currentUser.role}
            userName={currentUser.name}
            customSidebar={
                <ProjectSidebar
                    projectId={id || ''}
                    projectName={project.projectName}
                    activeTab={activeTab}
                    onTabChange={(tab: any) => setActiveTab(tab)}
                    roleName={currentMember?.roleName || currentMember?.projectRoleName || project?.roleName}
                />
            }
        >
            {toast && <Toast message={toast.message} type={toast.type} duration={toast.duration} onClose={() => setToast(null)} />}

            <div style={{ padding: '0' }}>
                {/* ─── Shared Project Header ──────────────────────────────── */}
                <div style={{
                    background: 'white',
                    borderBottom: '1px solid var(--border-color)',
                    padding: '1.5rem 2rem',
                    margin: '-1.5rem -2rem 2rem'
                }}>
                    {/* Back link */}
                    <button
                        onClick={() => navigate('/projects')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'none', border: 'none',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            marginBottom: '1.25rem', padding: 0,
                            fontSize: '0.9rem', fontWeight: 600
                        }}
                    >
                        <ArrowLeft size={16} /> Back to Researcher Space
                    </button>

                    {/* Project title row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '16px',
                                background: 'linear-gradient(135deg, var(--primary-color) 0%, #4f46e5 100%)',
                                color: 'white', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontWeight: 700, fontSize: '1.5rem'
                            }}>
                                {(project.projectName || 'P').charAt(0)}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                    <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{project.projectName}</h1>
                                    <span style={{
                                        fontSize: '0.7rem', padding: '4px 10px', borderRadius: '20px',
                                        background: getStatusStyle(project.status).bg,
                                        color: getStatusStyle(project.status).color,
                                        fontWeight: 600, textTransform: 'uppercase'
                                    }}>{getStatusStyle(project.status).label}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={14} />
                                        {formatProjectDate(project.createdAt, 'Established N/A') === 'Established N/A' ? 'Established N/A' : `Created ${new Date(project.createdAt!).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                                        {(project.NameProjectCreator || project.nameProjectCreator || project.createdBy) && ` by ${project.NameProjectCreator || project.nameProjectCreator || project.createdBy}`}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Users size={14} /> {members.length} Active Members
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            {canManageProject && activeTab !== 'settings' && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setActiveTab('settings')}
                                    style={{ opacity: isArchived && !isAdmin ? 0.7 : 1, display: 'flex', alignItems: 'center' }}
                                >
                                    <Settings size={18} style={{ marginRight: '8px' }} />
                                    {isArchived && !isAdmin ? 'View Configuration' : 'Configuration'}
                                </button>
                            )}
                            {activeTab !== 'settings' && (
                                <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center' }}>
                                    <Activity size={18} style={{ marginRight: '8px' }} /> Export Reports
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── Archive Banner ─────────────────────────────────────── */}
                {isArchived && (
                    <div style={{
                        marginBottom: '1.5rem', padding: '1rem 1.5rem',
                        background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', gap: '12px', color: '#c2410c'
                    }}>
                        <ShieldAlert size={20} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                            This project is <strong>Archived</strong>. Workspace is archived for historical preservation.
                            {isAdmin ? ' Since you are an ADMIN, you still have full access.' : ' Configuration and activities are locked.'}
                        </span>
                    </div>
                )}

                {/* ─── Main Layout ─────────────────────────────────────────── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: activeTab === 'tasks' || activeTab === 'members' || activeTab === 'milestones' || activeTab === 'timeline' ? '1fr' : 'minmax(0, 1fr) 300px',
                    gap: '2rem'
                }}>

                    {/* Left column — tab content */}
                    <div style={{ minWidth: 0 }}>

                        {/* ── HOME ──────────────────────────────────────────── */}
                        {activeTab === 'home' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <section className="card">
                                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</h4>
                                    <p style={{ margin: 0, lineHeight: '1.7', color: '#475569' }}>
                                        {project.projectDescription || "No description provided."}
                                    </p>
                                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                                        <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>RESEARCH FIELDS</h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {project.researchFields?.map((field, index) => (
                                                <span key={field.id || index} style={{
                                                    padding: '6px 12px', background: '#f8fafc',
                                                    border: '1px solid #e2e8f0', borderRadius: '20px',
                                                    fontSize: '0.8rem', fontWeight: 500
                                                }}>
                                                    {field.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <section className="card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Recent Tasks</h4>
                                            <button className="btn btn-text" style={{ fontSize: '0.8rem' }} onClick={() => setActiveTab('tasks')}>View All</button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <style>{`
                                                @keyframes warningBlink {
                                                    0%, 100% { opacity: 1; transform: scale(1); }
                                                    50% { opacity: 0.5; transform: scale(1.3); }
                                                }
                                            `}</style>
                                            {[...tasks]
                                                .sort((a, b) => {
                                                    const isNearDeadlineA = a.dueDate && (a.status !== TaskStatus.Completed && a.status !== TaskStatus.Submitted) && ((new Date(a.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3;
                                                    const isNearDeadlineB = b.dueDate && (b.status !== TaskStatus.Completed && b.status !== TaskStatus.Submitted) && ((new Date(b.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3;

                                                    if (isNearDeadlineA && !isNearDeadlineB) return -1;
                                                    if (!isNearDeadlineA && isNearDeadlineB) return 1;

                                                    const aDone = a.status === TaskStatus.Completed || a.status === TaskStatus.Submitted;
                                                    const bDone = b.status === TaskStatus.Completed || b.status === TaskStatus.Submitted;
                                                    if (!aDone && bDone) return -1;
                                                    if (aDone && !bDone) return 1;

                                                    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                                                    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                                                    return dateA - dateB;
                                                })
                                                .slice(0, 3)
                                                .map(task => {
                                                    const getStatusColor = (status: TaskStatus) => {
                                                        switch (status) {
                                                            case TaskStatus.Todo: return '#64748b';
                                                            case TaskStatus.InProgress: return '#0ea5e9';
                                                            case TaskStatus.Submitted: return '#7c3aed';
                                                            case TaskStatus.Missed: return '#ef4444';
                                                            case TaskStatus.Adjusting: return '#f59e0b';
                                                            case TaskStatus.Completed: return '#10b981';
                                                            default: return '#64748b';
                                                        }
                                                    };

                                                    const isNearDeadline = task.dueDate && (task.status !== TaskStatus.Completed && task.status !== TaskStatus.Submitted) && ((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3;

                                                    return (
                                                        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', padding: '8px', border: '1px solid #f1f5f9', borderRadius: '8px', position: 'relative' }}>
                                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getStatusColor(task.status) }} />
                                                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.name}</span>
                                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatProjectDate(task.dueDate, 'No date')}</span>
                                                            {isNearDeadline && (
                                                                <div style={{
                                                                    position: 'absolute', right: '-4px', top: '-4px',
                                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                                    background: '#ef4444', border: '1.5px solid white',
                                                                    boxShadow: '0 0 6px #ef4444',
                                                                    animation: 'warningBlink 1s ease-in-out infinite'
                                                                }} title="Deadline is within 3 days or overdue!" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            {tasks.length === 0 && <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>No recent research tasks.</p>}
                                        </div>
                                    </section>

                                    <section className="card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Milestones</h4>
                                            <button className="btn btn-text" style={{ fontSize: '0.8rem' }} onClick={() => setActiveTab('milestones')}>Roadmap</button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {milestones.slice(0, 3).map(m => (
                                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', padding: '8px', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                                                    <Activity size={14} style={{ color: 'var(--accent-color)' }} />
                                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                                                </div>
                                            ))}
                                            {milestones.length === 0 && <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>No milestones defined yet.</p>}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {/* ── TIMELINE ──────────────────────────────────────── */}
                        {activeTab === 'timeline' && project && (
                            <ProjectTimeline
                                project={project}
                                timelineData={timelineData}
                                onTaskClick={handleTaskClick}
                                onMilestoneClick={handleMilestoneClick}
                            />
                        )}

                        {activeTab === 'milestones' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ margin: 0 }}>Research Roadmap</h2>
                                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Phases and critical path for this research project.</p>
                                    </div>
                                    {canManageMilestones && (
                                        <button
                                            className="btn btn-primary"
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                            onClick={() => setIsMilestoneModalOpen(true)}
                                        >
                                            <Plus size={18} /> New Phase
                                        </button>
                                    )}
                                </div>

                                {/* Summary Stats */}
                                <div style={{ display: 'flex', gap: '1rem', width: '100%', flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Total Phases', count: milestones.length, color: '#64748b', bg: '#f1f5f9', icon: <Activity size={18} /> },
                                        { label: 'In Progress', count: milestones.filter(m => m.status === MilestoneStatus.InProgress).length, color: '#E8720C', bg: '#fff7ed', icon: <Clock size={18} /> },
                                        { label: 'Completed', count: milestones.filter(m => m.status === MilestoneStatus.Completed).length, color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle2 size={18} /> },
                                        { label: 'Upcoming', count: milestones.filter(m => m.status === MilestoneStatus.NotStarted).length, color: '#3b82f6', bg: '#eff6ff', icon: <Flag size={18} /> }
                                    ].map((stat, i) => (
                                        <div key={i} style={{
                                            flex: '1 1 200px', padding: '1.25rem', borderRadius: '16px', background: 'white',
                                            border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem'
                                        }}>
                                            <div style={{
                                                width: '44px', height: '44px', borderRadius: '12px', background: stat.bg,
                                                color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {stat.icon}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>{stat.count}</div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{stat.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1.25rem',
                                    background: '#f8fafc',
                                    padding: '1.5rem',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input
                                                type="text"
                                                placeholder="Search phases by name or description..."
                                                value={milestoneSearchQuery}
                                                onChange={(e) => setMilestoneSearchQuery(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 1rem 0.75rem 2.5rem',
                                                    borderRadius: '12px',
                                                    border: '1.5px solid #e2e8f0',
                                                    fontSize: '0.9rem',
                                                    outline: 'none',
                                                    transition: 'border-color 0.2s',
                                                    background: 'white'
                                                }}
                                            />
                                        </div>

                                        <select
                                            value={milestoneStatusFilter}
                                            onChange={(e) => setMilestoneStatusFilter(e.target.value)}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                borderRadius: '12px',
                                                border: '1.5px solid #e2e8f0',
                                                background: 'white',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                                minWidth: '160px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="all">Any Status</option>
                                            <option value={MilestoneStatus.NotStarted.toString()}>Not Started</option>
                                            <option value={MilestoneStatus.InProgress.toString()}>In Progress</option>
                                            <option value={MilestoneStatus.Completed.toString()}>Completed</option>
                                            <option value={MilestoneStatus.OnHold.toString()}>On Hold</option>
                                            <option value={MilestoneStatus.Cancelled.toString()}>Cancelled</option>
                                        </select>

                                        <button
                                            onClick={() => {
                                                setMilestoneSearchQuery('');
                                                setMilestoneStatusFilter('all');
                                            }}
                                            style={{
                                                padding: '0.75rem 1.25rem',
                                                background: 'white',
                                                border: '1.5px solid #e2e8f0',
                                                borderRadius: '12px',
                                                color: '#64748b',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Reset Filters
                                        </button>
                                    </div>
                                </div>

                                <div
                                    ref={milestoneContainerRef}
                                    style={{
                                        maxHeight: '600px',
                                        overflowY: filteredMilestones.length > 3 ? 'auto' : 'visible',
                                        paddingLeft: '6rem', // More space for date labels
                                        paddingRight: '1rem',
                                        paddingTop: '1rem',
                                        paddingBottom: '1rem',
                                        position: 'relative'
                                    }} className="custom-scrollbar">
                                    {filteredMilestones.length > 0 ? filteredMilestones.map((milestone, idx) => (
                                        <div
                                            key={milestone.id}
                                            id={`milestone-item-${milestone.id}`}
                                            style={{
                                                position: 'relative',
                                                marginBottom: idx === filteredMilestones.length - 1 ? 0 : '2rem'
                                            }}
                                        >
                                            {/* Vertical Line Segment */}
                                            {idx < filteredMilestones.length - 1 && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '-3.18rem', // Center with node (-4rem + 13px = -3.18rem approx)
                                                    top: '36px',
                                                    bottom: '-2rem', // Connect to next
                                                    width: '2px',
                                                    background: idx >= 2 ? 'none' : '#e2e8f0',
                                                    borderLeft: idx >= 2 ? '2px dashed #e2e8f0' : 'none',
                                                    zIndex: 1
                                                }} />
                                            )}

                                            {/* Timeline Node */}
                                            <div style={{
                                                position: 'absolute',
                                                left: '-4rem',
                                                top: '10px',
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '50%',
                                                background: 'white',
                                                border: `3px solid ${milestone.status === MilestoneStatus.Completed ? '#10b981' :
                                                    milestone.status === MilestoneStatus.InProgress ? '#E8720C' : '#e2e8f0'
                                                    }`,
                                                zIndex: 2,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: milestone.status === MilestoneStatus.InProgress ? '#E8720C' :
                                                        milestone.status === MilestoneStatus.Completed ? '#10b981' : '#e2e8f0'
                                                }} />

                                                {/* Node Due Date Label */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '28px',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    color: '#94a3b8',
                                                    whiteSpace: 'nowrap',
                                                    textAlign: 'center'
                                                }}>
                                                    {milestone.dueDate ? formatProjectDate(milestone.dueDate) : ''}
                                                </div>
                                            </div>
                                            <MilestoneItem milestone={milestone} onClick={handleMilestoneClick} />
                                        </div>
                                    )) : (
                                        <div className="card" style={{ textAlign: 'center', padding: '3rem', marginLeft: '-2.5rem' }}>
                                            <p style={{ color: 'var(--text-secondary)' }}>
                                                {milestones.length === 0 ? "No milestones have been defined for this research project." : "No milestones match your search criteria."}
                                            </p>
                                        </div>
                                    )}

                                    {/* Quick Add Forms */}
                                    {quickAddMilestones.map((form, index) => {
                                        const isOverlapping = checkOverlap(form.startDate, form.dueDate);
                                        return (
                                            <div
                                                key={form.tempId}
                                                style={{
                                                    position: 'relative',
                                                    marginBottom: '2rem',
                                                    marginTop: index === 0 ? '4rem' : '0',
                                                    background: 'white',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '16px',
                                                    padding: '1.25rem',
                                                    boxShadow: 'var(--shadow-sm)',
                                                    transition: 'all 0.3s'
                                                }}
                                            >
                                                {/* Timeline decoration for quick add form */}
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '-4rem',
                                                    top: '10px',
                                                    width: '26px',
                                                    height: '26px',
                                                    borderRadius: '50%',
                                                    background: 'white',
                                                    border: '3px solid #cbd5e1',
                                                    zIndex: 2,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }} />
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                                        <Plus size={16} />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>New Quick Phase</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveQuickForm(form.tempId)}
                                                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>PHASE NAME</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="Enter phase name..."
                                                            value={form.name}
                                                            onChange={(e) => handleQuickMilestoneChange(form.tempId, 'name', e.target.value)}
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>START DATE</label>
                                                            <input
                                                                type="date"
                                                                className="form-input"
                                                                style={{
                                                                    borderColor: isOverlapping ? '#E8720C' : undefined,
                                                                    boxShadow: isOverlapping ? '0 0 0 1px #E8720C' : undefined
                                                                }}
                                                                value={form.startDate}
                                                                onChange={(e) => handleQuickMilestoneChange(form.tempId, 'startDate', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>DUE DATE</label>
                                                            <input
                                                                type="date"
                                                                className="form-input"
                                                                style={{
                                                                    borderColor: isOverlapping ? '#E8720C' : undefined,
                                                                    boxShadow: isOverlapping ? '0 0 0 1px #E8720C' : undefined
                                                                }}
                                                                value={form.dueDate}
                                                                onChange={(e) => handleQuickMilestoneChange(form.tempId, 'dueDate', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                                    <div style={{ flex: 1, marginRight: '1rem' }}>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>DESCRIPTION (OPTIONAL)</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="Add a brief description..."
                                                            value={form.description}
                                                            onChange={(e) => handleQuickMilestoneChange(form.tempId, 'description', e.target.value)}
                                                        />
                                                    </div>
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ height: '42px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                        onClick={() => handleQuickMilestoneSave(form.tempId)}
                                                    >
                                                        <Save size={18} /> Save
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Quick Add Button at the bottom */}
                                    {canManageMilestones && !isArchived && (
                                        <button
                                            onClick={handleAddQuickMilestone}
                                            style={{
                                                width: '100%',
                                                padding: '1rem',
                                                background: 'transparent',
                                                border: '2px dashed #cbd5e1',
                                                borderRadius: '16px',
                                                color: '#64748b',
                                                fontSize: '0.9rem',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                marginTop: filteredMilestones.length > 0 ? '1rem' : 0
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.background = '#f1f5f9';
                                                e.currentTarget.style.borderColor = '#94a3b8';
                                                e.currentTarget.style.color = 'var(--primary-color)';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.borderColor = '#cbd5e1';
                                                e.currentTarget.style.color = '#64748b';
                                            }}
                                        >
                                            <Plus size={20} /> Add Quick Research Phase
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── MEMBERS ───────────────────────────────────────── */}
                        {activeTab === 'members' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ margin: 0 }}>Research Team</h2>
                                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage contributors and roles within this project.</p>
                                    </div>
                                    {canManageProject && (
                                        <button
                                            className="btn btn-primary"
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                            onClick={() => setIsAddMemberModalOpen(true)}
                                        >
                                            <UserPlus size={18} /> Add Member
                                        </button>
                                    )}
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: '12px',
                                    background: '#f8fafc',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    marginBottom: '0.5rem'
                                }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            placeholder="Search members by name, email or role..."
                                            value={memberSearchQuery}
                                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.6rem 1rem 0.6rem 2.5rem',
                                                borderRadius: '8px',
                                                border: '1.5px solid #e2e8f0',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                background: 'white'
                                            }}
                                        />
                                    </div>
                                    {memberSearchQuery && (
                                        <button
                                            onClick={() => setMemberSearchQuery('')}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                    {filteredMembers.length > 0 ? filteredMembers.map((member, index) => (
                                        <div
                                            key={member.id || member.memberId || index}
                                            className="card"
                                            onClick={() => {
                                                setSelectedMember(member);
                                                setIsMemberDetailModalOpen(true);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '15px',
                                                padding: '1.25rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                border: '1px solid transparent'
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--primary-color)';
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.borderColor = 'transparent';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            <div style={{
                                                width: '48px', height: '48px', borderRadius: '50%',
                                                background: '#f1f5f9', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary-color)'
                                            }}>{(member.fullName || member.userName)?.charAt(0) || 'U'}</div>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: 0, fontSize: '1rem' }}>{member.fullName || member.userName}</h4>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{member.roleName || member.projectRoleName}</p>
                                                {(member.joinDate || member.joinedDate) && (
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
                                                        In team since {new Date(member.joinDate || member.joinedDate).toLocaleDateString()}
                                                    </p>
                                                )}
                                            </div>
                                            <div style={{
                                                padding: '4px 8px',
                                                background: member.status === 1 ? '#ecfdf5' : '#fef2f2',
                                                color: member.status === 1 ? '#10b981' : '#ef4444',
                                                borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700
                                            }}>{member.status === 1 ? 'ACTIVE' : 'INACTIVE'}</div>
                                        </div>
                                    )) : (
                                        <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
                                            <p style={{ color: 'var(--text-secondary)' }}>
                                                {memberSearchQuery ? "No members match your search criteria." : "No members have been added to this research project yet."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── TASKS ─────────────────────────────────────────── */}
                        {activeTab === 'tasks' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ margin: 0 }}>Research Activities</h2>
                                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Track experimentation, analysis, and documentation progress.</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div style={{ display: 'flex', padding: '4px', background: '#f1f5f9', borderRadius: '8px' }}>
                                            {(['board', 'list'] as const).map(view => (
                                                <button key={view} onClick={() => setTaskView(view)} style={{
                                                    padding: '6px 12px', borderRadius: '6px', border: 'none',
                                                    background: taskView === view ? 'white' : 'transparent',
                                                    color: taskView === view ? 'var(--accent-color)' : 'var(--text-secondary)',
                                                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                                                    boxShadow: taskView === view ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                                }}>{view.charAt(0).toUpperCase() + view.slice(1)}</button>
                                            ))}
                                        </div>
                                        {canAddTask && (
                                            <button
                                                className="btn btn-primary"
                                                onClick={addInlineTask}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isArchived && !isAdmin ? 0.5 : 1, cursor: isArchived && !isAdmin ? 'not-allowed' : 'pointer' }}
                                                disabled={isArchived && !isAdmin}
                                            >
                                                <Plus size={18} /> New Activity
                                            </button>
                                        )}
                                    </div>
                                </div>


                                <div style={{
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center',
                                    background: '#f8fafc',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    marginBottom: '0.25rem',
                                    position: 'relative'
                                }}>
                                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            placeholder="Search activities..."
                                            value={taskSearchQuery}
                                            onChange={(e) => setTaskSearchQuery(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.6rem 1rem 0.6rem 2.5rem',
                                                borderRadius: '10px',
                                                border: '1.5px solid #e2e8f0',
                                                fontSize: '0.85rem',
                                                fontWeight: 500,
                                                outline: 'none',
                                                background: 'white',
                                                transition: 'border-color 0.2s'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => setShowTaskFilters(!showTaskFilters)}
                                            style={{
                                                padding: '0.65rem 1.25rem',
                                                background: showTaskFilters ? '#f1f5f9' : 'white',
                                                border: '1.5px solid #e2e8f0',
                                                borderRadius: '10px',
                                                color: '#475569',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Filter size={16} />
                                            Filter
                                        </button>

                                        {showTaskFilters && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 'calc(100% + 8px)',
                                                right: '1rem',
                                                width: '320px',
                                                background: 'white',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '16px',
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                                padding: '1.25rem',
                                                zIndex: 1000,
                                                animation: 'fadeInY 0.2s ease-out'
                                            }}>
                                                <div style={{ marginBottom: '1.25rem' }}>
                                                    <h4 style={{ margin: '0 0 10px', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                        {[
                                                            { id: TaskStatus.Todo, label: 'To Do' },
                                                            { id: TaskStatus.InProgress, label: 'In Progress' },
                                                            { id: TaskStatus.Submitted, label: 'Submitted' },
                                                            { id: TaskStatus.Completed, label: 'Completed' },
                                                            { id: TaskStatus.Missed, label: 'Missed' },
                                                            { id: TaskStatus.Adjusting, label: 'Adjusting' }
                                                        ].map(s => {
                                                            const isChecked = taskStatusFilters.includes(s.id.toString());
                                                            return (
                                                                <div key={s.id} onClick={() => {
                                                                    setTaskStatusFilters(prev => isChecked ? prev.filter(p => p !== s.id.toString()) : [...prev, s.id.toString()]);
                                                                }}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', background: isChecked ? '#f0f9ff' : 'transparent', border: `1px solid ${isChecked ? '#bae6fd' : 'transparent'}`
                                                                    }}>
                                                                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1.5px solid #cbd5e1', background: isChecked ? 'var(--primary-color)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        {isChecked && <Check size={12} color="white" strokeWidth={3} />}
                                                                    </div>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isChecked ? '#0369a1' : '#64748b' }}>{s.label}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div style={{ marginBottom: '1.25rem' }}>
                                                    <h4 style={{ margin: '0 0 10px', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phases (Milestones)</h4>
                                                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }} className="custom-scrollbar-thin">
                                                        {milestones.map(m => {
                                                            const isChecked = taskMilestoneFilters.includes(m.id);
                                                            return (
                                                                <div key={m.id} onClick={() => {
                                                                    setTaskMilestoneFilters(prev => isChecked ? prev.filter(p => p !== m.id) : [...prev, m.id]);
                                                                }}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', background: isChecked ? '#f0f9ff' : 'transparent', border: `1px solid ${isChecked ? '#bae6fd' : 'transparent'}`
                                                                    }}>
                                                                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1.5px solid #cbd5e1', background: isChecked ? 'var(--primary-color)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        {isChecked && <Check size={12} color="white" strokeWidth={3} />}
                                                                    </div>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isChecked ? '#0369a1' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                                    <button onClick={() => { setTaskStatusFilters([]); setTaskMilestoneFilters([]); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Clear Filters</button>
                                                    <button onClick={() => setShowTaskFilters(false)} style={{ background: 'var(--primary-color)', border: 'none', color: 'white', padding: '6px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Done</button>
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setShowMyTasks(!showMyTasks)}
                                            style={{
                                                padding: '0.65rem 1.25rem',
                                                background: showMyTasks ? 'var(--primary-color)' : 'white',
                                                border: '1.5px solid',
                                                borderColor: showMyTasks ? 'var(--primary-color)' : '#e2e8f0',
                                                borderRadius: '10px',
                                                color: showMyTasks ? 'white' : '#64748b',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <User size={16} />
                                            {showMyTasks ? 'My Items' : 'All Items'}
                                        </button>

                                        <button
                                            onClick={() => {
                                                setTaskSearchQuery('');
                                                setTaskStatusFilters([]);
                                                setTaskPriorityFilter('all');
                                                setTaskMilestoneFilters([]);
                                                setTaskStartDateFilter('');
                                                setTaskEndDateFilter('');
                                                setShowTaskFilters(false);
                                            }}
                                            style={{
                                                padding: '0.65rem 1.25rem',
                                                background: 'white',
                                                border: '1.5px solid #e2e8f0',
                                                borderRadius: '10px',
                                                color: '#b91c1c', // Clear color
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            title="Reset all search/filters"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>

                                {/* Action Header for Roadmap */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '4px', height: '18px', background: 'var(--primary-color)', borderRadius: '2px' }} />
                                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activities Roadmap</h3>
                                    </div>
                                </div>

                                {/* Roadmap Context */}
                                <div style={{ marginBottom: '1rem', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', background: 'white', minHeight: '350px' }}>
                                    <TaskRoadmapPreview
                                        existingTasks={filteredTasks.map(t => ({
                                            id: t.id,
                                            name: t.name,
                                            startDate: t.startDate || t.createdAt || "",
                                            dueDate: t.dueDate || "",
                                            description: t.description || "",
                                            status: Number(t.status)
                                        }))}
                                        newTasks={newTasks.filter(r => r.name && r.startDate && r.dueDate).map(r => ({
                                            id: r.id,
                                            name: r.name,
                                            startDate: r.startDate,
                                            dueDate: r.dueDate
                                        }))}
                                        projectStartDate={project?.startDate || undefined}
                                        projectEndDate={project?.endDate || undefined}
                                    />
                                </div>

                                {/* Quick Actions moved below Roadmap */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '1rem', paddingRight: '4px' }}>
                                    <button
                                        onClick={() => setIsDraftQueueOpen(!isDraftQueueOpen)}
                                        style={{
                                            padding: '0.6rem 1.25rem',
                                            fontSize: '0.8rem',
                                            fontWeight: 800,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            background: isDraftQueueOpen ? '#f1f5f9' : 'white',
                                            border: '1.5px solid #e2e8f0',
                                            borderRadius: '10px',
                                            color: isDraftQueueOpen ? 'var(--primary-color)' : '#64748b',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {isDraftQueueOpen ? 'Hide Draft' : 'Show Drafts'}
                                        {newTasks.length > 0 && (
                                            <span style={{
                                                background: 'var(--primary-color)',
                                                color: 'white',
                                                borderRadius: '20px',
                                                padding: '1px 8px',
                                                fontSize: '0.7rem'
                                            }}>{newTasks.length}</span>
                                        )}
                                    </button>
                                    {canAddTask && (
                                        <button
                                            className="btn btn-primary"
                                            onClick={addInlineTask}
                                            style={{
                                                padding: '0.6rem 1.5rem',
                                                fontSize: '0.8rem',
                                                fontWeight: 900,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                borderRadius: '10px',
                                                boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.2)'
                                            }}
                                        >
                                            <Plus size={18} strokeWidth={3} /> New Task
                                        </button>
                                    )}
                                </div>

                                {/* Collapsible Queue */}
                                {isDraftQueueOpen && newTasks.length > 0 && (
                                    <div style={{ marginBottom: '1.5rem', animation: 'fadeInDown 0.3s ease-out' }}>
                                        <style>{`
                                                @keyframes fadeInDown {
                                                    from { opacity: 0; transform: translateY(-10px); }
                                                    to { opacity: 1; transform: translateY(0); }
                                                }
                                            `}</style>
                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', paddingLeft: '4px', position: 'relative' }}>
                                            {(() => {
                                                const MAX_VISIBLE = 4;
                                                const visible = newTasks.slice(0, MAX_VISIBLE);
                                                const hidden = newTasks.slice(MAX_VISIBLE);

                                                return (
                                                    <>
                                                        {visible.map((t, idx) => (
                                                            <div
                                                                key={t.id}
                                                                onClick={() => setActiveTaskDraftId(t.id)}
                                                                style={{
                                                                    padding: '10px 20px',
                                                                    background: activeTaskDraftId === t.id ? 'white' : '#f1f5f9',
                                                                    border: '1.5px solid #e2e8f0',
                                                                    borderBottom: activeTaskDraftId === t.id ? 'none' : '1.5px solid #e2e8f0',
                                                                    borderRadius: '12px 12px 0 0',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: activeTaskDraftId === t.id ? 800 : 600,
                                                                    color: activeTaskDraftId === t.id ? 'var(--primary-color)' : '#64748b',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '10px',
                                                                    position: 'relative',
                                                                    top: activeTaskDraftId === t.id ? '2px' : '0',
                                                                    zIndex: activeTaskDraftId === t.id ? 10 : 1,
                                                                    maxWidth: '180px',
                                                                    boxShadow: activeTaskDraftId === t.id ? '0 -4px 10px rgba(0,0,0,0.03)' : 'none',
                                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                                }}
                                                            >
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {t.name || `Draft ${idx + 1}`}
                                                                </span>
                                                                <X
                                                                    size={14}
                                                                    onClick={(e) => { e.stopPropagation(); removeInlineTask(t.id); }}
                                                                    style={{
                                                                        marginLeft: '4px',
                                                                        padding: '2px',
                                                                        borderRadius: '4px',
                                                                        background: activeTaskDraftId === t.id ? '#fef2f2' : 'transparent',
                                                                        color: activeTaskDraftId === t.id ? '#ef4444' : '#94a3b8'
                                                                    }}
                                                                />
                                                            </div>
                                                        ))}

                                                        {hidden.length > 0 && (
                                                            <div style={{ position: 'relative' }}>
                                                                <button
                                                                    onClick={() => setShowDraftDropdown(!showDraftDropdown)}
                                                                    style={{
                                                                        background: hidden.some(h => h.id === activeTaskDraftId) ? 'white' : '#f1f5f9',
                                                                        border: '1.5px solid #e2e8f0',
                                                                        borderBottom: hidden.some(h => h.id === activeTaskDraftId) ? 'none' : '1.5px solid #e2e8f0',
                                                                        borderRadius: '12px 12px 0 0',
                                                                        padding: '10px 15px',
                                                                        color: hidden.some(h => h.id === activeTaskDraftId) ? 'var(--primary-color)' : '#64748b',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 800,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px',
                                                                        height: 'auto',
                                                                        top: hidden.some(h => h.id === activeTaskDraftId) ? '2px' : '0',
                                                                        position: 'relative',
                                                                        zIndex: 10
                                                                    }}
                                                                >
                                                                    {hidden.some(h => h.id === activeTaskDraftId)
                                                                        ? (newTasks.find(t => t.id === activeTaskDraftId)?.name || 'Active Draft')
                                                                        : `More (${hidden.length})`}
                                                                    <ChevronDown size={14} style={{ transform: showDraftDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                                                </button>

                                                                {showDraftDropdown && (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: 'calc(100% + 5px)',
                                                                        left: 0,
                                                                        width: '260px',
                                                                        maxHeight: '220px',
                                                                        overflowY: 'auto',
                                                                        background: 'white',
                                                                        border: '1.5px solid #e2e8f0',
                                                                        borderRadius: '12px',
                                                                        boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                                                                        zIndex: 100,
                                                                        padding: '8px',
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        gap: '4px',
                                                                        scrollbarWidth: 'thin',
                                                                        scrollbarColor: '#e2e8f0 transparent'
                                                                    }}>
                                                                        <style>{`
                                                                                div::-webkit-scrollbar { width: 4px; }
                                                                                div::-webkit-scrollbar-track { background: transparent; }
                                                                                div::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                                                                            `}</style>
                                                                        {hidden.map((t, idx) => (
                                                                            <div
                                                                                key={t.id}
                                                                                onClick={() => { setActiveTaskDraftId(t.id); setShowDraftDropdown(false); }}
                                                                                style={{
                                                                                    padding: '8px 12px',
                                                                                    borderRadius: '8px',
                                                                                    fontSize: '0.75rem',
                                                                                    cursor: 'pointer',
                                                                                    background: activeTaskDraftId === t.id ? '#f1f5f9' : 'transparent',
                                                                                    color: activeTaskDraftId === t.id ? 'var(--primary-color)' : '#475569',
                                                                                    fontWeight: activeTaskDraftId === t.id ? 700 : 500,
                                                                                    display: 'flex',
                                                                                    justifyContent: 'space-between',
                                                                                    alignItems: 'center'
                                                                                }}
                                                                                onMouseOver={(e) => { if (activeTaskDraftId !== t.id) e.currentTarget.style.background = '#f8fafc'; }}
                                                                                onMouseOut={(e) => { if (activeTaskDraftId !== t.id) e.currentTarget.style.background = 'transparent'; }}
                                                                            >
                                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                                                    {t.name || `Draft ${idx + 5}`}
                                                                                </span>
                                                                                <X
                                                                                    size={12}
                                                                                    onClick={(e) => { e.stopPropagation(); removeInlineTask(t.id); }}
                                                                                    style={{ marginLeft: '8px', color: '#94a3b8' }}
                                                                                />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}

                                            <button
                                                onClick={addInlineTask}
                                                title="Add another draft"
                                                style={{
                                                    background: '#f8fafc',
                                                    border: '1.5px solid #e2e8f0',
                                                    borderBottom: 'none',
                                                    borderRadius: '8px 8px 0 0',
                                                    padding: '8px 12px',
                                                    color: '#94a3b8',
                                                    cursor: 'pointer',
                                                    marginBottom: '0',
                                                    height: '35px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginLeft: '4px',
                                                    transition: 'all 0.2s',
                                                    position: 'relative',
                                                    top: '1px'
                                                }}
                                                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--primary-color)'; e.currentTarget.style.background = 'white'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; }}
                                            >
                                                <Plus size={18} strokeWidth={3} />
                                            </button>
                                        </div>

                                        <div style={{
                                            background: 'white',
                                            border: '1.5px solid #e2e8f0',
                                            borderTopLeftRadius: activeTaskDraftId === newTasks[0]?.id ? 0 : '16px',
                                            borderRadius: '0 16px 16px 16px',
                                            padding: '2rem',
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.04)',
                                            position: 'relative',
                                            zIndex: 5
                                        }}>
                                            {newTasks.find(row => row.id === activeTaskDraftId) && (() => {
                                                const row = newTasks.find(t => t.id === activeTaskDraftId)!;
                                                const todayStr = new Date().toISOString().split('T')[0];
                                                const selectedMilestone = milestones.find(m => m.id === row.milestoneId);
                                                const mStart = selectedMilestone ? selectedMilestone.startDate.split('T')[0] : '';
                                                const mEnd = selectedMilestone ? selectedMilestone.dueDate.split('T')[0] : '';
                                                
                                                const isStartInvalid = !!(row.startDate < todayStr || (selectedMilestone && (row.startDate < mStart || (mEnd && row.startDate > mEnd))));
                                                const isDueInvalid = !!(row.dueDate < todayStr || (selectedMilestone && (row.dueDate < mStart || (mEnd && row.dueDate > mEnd))));
                                                const isDueBeforeStart = !!(row.startDate && row.dueDate && row.dueDate < row.startDate);
                                                const isAnyInvalid = !!(isStartInvalid || isDueInvalid || isDueBeforeStart);

                                                return (
                                                    <>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr', gap: '1rem' }}>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task Title</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-input"
                                                                    placeholder="Task name"
                                                                    value={row.name}
                                                                    onChange={(e) => updateInlineTask(row.id, 'name', e.target.value)}
                                                                    style={{ padding: '0.65rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}
                                                                />
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Linked Phase</label>
                                                                <select
                                                                    className="form-input"
                                                                    value={row.milestoneId}
                                                                    onChange={(e) => updateInlineTask(row.id, 'milestoneId', e.target.value)}
                                                                    style={{ padding: '0.65rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}
                                                                >
                                                                    <option value="">No phase linked</option>
                                                                    {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</label>
                                                                <select
                                                                    className="form-input"
                                                                    value={row.priority}
                                                                    onChange={(e) => updateInlineTask(row.id, 'priority', e.target.value)}
                                                                    style={{ padding: '0.65rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}
                                                                >
                                                                    <option value="1">Low</option>
                                                                    <option value="2">Medium</option>
                                                                    <option value="3">High</option>
                                                                    <option value="4">Critical</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(140px, 1fr) 1.5fr 1.5fr', gap: '1rem', marginTop: '1rem' }}>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: isStartInvalid ? '#ef4444' : '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    Start Date {isStartInvalid && <span style={{ textTransform: 'none', marginLeft: '4px', fontWeight: 500 }}>({row.startDate < todayStr ? 'Past date' : 'Out of range'})</span>}
                                                                </label>
                                                                <input
                                                                    type="date"
                                                                    className="form-input"
                                                                    value={row.startDate}
                                                                    min={mStart > todayStr ? mStart : todayStr}
                                                                    max={mEnd || undefined}
                                                                    onChange={(e) => updateInlineTask(row.id, 'startDate', e.target.value)}
                                                                    style={{ 
                                                                        padding: '0.65rem 1rem', 
                                                                        borderRadius: '10px', 
                                                                        fontSize: '0.85rem',
                                                                        border: isStartInvalid ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: (isDueInvalid || isDueBeforeStart) ? '#ef4444' : '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    Deadline {(isDueInvalid || isDueBeforeStart) && (
                                                                        <span style={{ textTransform: 'none', marginLeft: '4px', fontWeight: 500 }}>
                                                                            ({row.dueDate < todayStr ? 'Past date' : isDueBeforeStart ? 'Before start date' : 'Out of range'})
                                                                        </span>
                                                                    )}
                                                                </label>
                                                                <input
                                                                    type="date"
                                                                    className="form-input"
                                                                    value={row.dueDate}
                                                                    min={row.startDate > todayStr ? row.startDate : todayStr}
                                                                    max={mEnd || undefined}
                                                                    onChange={(e) => updateInlineTask(row.id, 'dueDate', e.target.value)}
                                                                    style={{ 
                                                                        padding: '0.65rem 1rem', 
                                                                        borderRadius: '10px', 
                                                                        fontSize: '0.85rem',
                                                                        border: (isDueInvalid || isDueBeforeStart) ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignees (Lead)</label>
                                                                <SearchableSelect
                                                                    options={members
                                                                        .filter(m => m.projectRole !== 1 && !(row.collaboratorIds || []).includes((m.memberId || m.id || '').toString()))
                                                                        .map(m => ({ id: (m.memberId || m.id || '').toString(), name: m.fullName || m.userName || 'Unknown Member' }))
                                                                    }
                                                                    value={row.memberIds}
                                                                    onChange={(val) => updateInlineTask(row.id, 'memberIds', val)}
                                                                    placeholder="No Lab Directors"
                                                                    multiple
                                                                />
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collaborators (Support)</label>
                                                                <SearchableSelect
                                                                    options={members
                                                                        .filter(m => m.projectRole !== 1 && !(row.memberIds || []).includes((m.memberId || m.id || '').toString()))
                                                                        .map(m => ({ id: (m.memberId || m.id || '').toString(), name: m.fullName || m.userName || 'Unknown Member' }))
                                                                    }
                                                                    value={row.collaboratorIds || []}
                                                                    onChange={(val) => updateInlineTask(row.id, 'collaboratorIds', val)}
                                                                    placeholder="No Lab Directors"
                                                                    multiple
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                                                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                                                            <textarea
                                                                className="form-input"
                                                                placeholder="Tell us more about this task..."
                                                                value={row.description}
                                                                onChange={(e) => updateInlineTask(row.id, 'description', e.target.value)}
                                                                style={{ padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', width: '100%', minHeight: '60px', resize: 'vertical' }}
                                                            />
                                                        </div>

                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                                            <button
                                                                onClick={() => saveInlineTask(row.id)}
                                                                className="btn btn-primary"
                                                                style={{ 
                                                                    padding: '0.65rem 1.75rem', 
                                                                    fontWeight: 800, 
                                                                    borderRadius: '10px', 
                                                                    fontSize: '0.85rem',
                                                                    opacity: (submitting || isAnyInvalid) ? 0.6 : 1,
                                                                    cursor: (submitting || isAnyInvalid) ? 'not-allowed' : 'pointer'
                                                                }}
                                                                disabled={submitting || isAnyInvalid}
                                                                title={isAnyInvalid ? "Please correct the dates to fit within the milestone range" : undefined}
                                                            >
                                                                {submitting ? 'Saving...' : 'Create Task'}
                                                            </button>
                                                            {newTasks.length > 1 && (
                                                                <button
                                                                    onClick={saveAllInlineTasks}
                                                                    className="btn btn-secondary"
                                                                    style={{ 
                                                                        padding: '0.65rem 1.75rem', 
                                                                        fontWeight: 800, 
                                                                        borderRadius: '10px', 
                                                                        fontSize: '0.85rem', 
                                                                        background: '#f8fafc', 
                                                                        color: isAnyInvalid ? '#94a3b8' : 'var(--primary-color)', 
                                                                        border: `1.5px solid ${isAnyInvalid ? '#e2e8f0' : 'var(--primary-color)'}`,
                                                                        opacity: (submitting || isAnyInvalid) ? 0.6 : 1,
                                                                        cursor: (submitting || isAnyInvalid) ? 'not-allowed' : 'pointer'
                                                                    }}
                                                                    disabled={submitting || isAnyInvalid}
                                                                    title={isAnyInvalid ? "Some tasks have invalid dates" : undefined}
                                                                >
                                                                    Save All ({newTasks.length})
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Command Bar for Search/Filters replaced by better positioned Search/Filter but we keep search here for logic */}

                                {tasks.length > 0 ? (
                                    taskView === 'board' ? (
                                        <KanbanBoard tasks={filteredTasks} projectMembers={members} projectId={id || ''} onTaskCreated={refetchTasks} onTaskUpdated={refetchTasks} milestones={milestones} />
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {filteredTasks.length > 0 ? (
                                                filteredTasks.map(task => {
                                                    const taskMilestone = milestones.find(m => m.id === task.milestoneId);
                                                    return (
                                                        <TaskItem
                                                            key={task.id}
                                                            task={task}
                                                            onClick={handleTaskClick}
                                                            milestoneName={taskMilestone?.name}
                                                            isCompact={true}
                                                        />
                                                    );
                                                })
                                            ) : (
                                                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                                                    <p style={{ color: 'var(--text-secondary)' }}>No research activities match your current search criteria.</p>
                                                </div>
                                            )}
                                        </div>
                                    )
                                ) : (
                                    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                                        <p style={{ color: 'var(--text-secondary)' }}>No active research activities found in this workspace.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SETTINGS / CONFIGURATION ──────────────────────── */}
                        {activeTab === 'settings' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {(isArchived || isReadOnly) && (
                                    <div className="card" style={{
                                        padding: '1rem 1.25rem', background: 'var(--warning-bg)',
                                        border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: '14px', color: '#92400E'
                                    }}>
                                        <ShieldAlert size={24} />
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#92400E' }}>
                                                {isArchived ? 'Project Archived' : 'Read-only Access'}
                                            </h4>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', opacity: 0.9 }}>
                                                {isArchived && isAdmin ? 'You have Administrative override to modify this project.' : 'You do not have permission to modify this project.'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Project Identity */}
                                <section className="card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <div>
                                            <h3 style={{ margin: 0 }}>Project Identity</h3>
                                            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Define the core vision and scope.</p>
                                        </div>
                                        <div style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-hover)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>STATUS:</span>
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    value={formData.status}
                                                    onChange={(e) => handleStatusChange(parseInt(e.target.value))}
                                                    className="form-input"
                                                    style={{ padding: '4px 28px 4px 10px', fontSize: '0.8rem', fontWeight: 700, color: getStatusStyle(formData.status).color, minWidth: '100px', appearance: 'none' }}
                                                    disabled={isReadOnly && !isAdmin}
                                                >
                                                    <option value={ProjectStatus.Active}>Active</option>
                                                    <option value={ProjectStatus.Inactive}>Inactive</option>
                                                    {(project?.status !== ProjectStatus.Archived || isAdmin) && <option value={ProjectStatus.Completed}>Completed</option>}
                                                    <option value={ProjectStatus.Archived}>Archived</option>
                                                </select>
                                                <ChevronDown size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" htmlFor="projectName">Project Name</label>
                                            <div style={{ position: 'relative' }}>
                                                <Briefcase size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                                <input className="form-input" style={{ paddingLeft: '40px' }} type="text" id="projectName" name="projectName" value={formData.projectName} onChange={handleInputChange} required disabled={isReadOnly} />
                                            </div>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" htmlFor="projectDescription">Description</label>
                                            <div style={{ position: 'relative' }}>
                                                <FileText size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                                <textarea className="form-input" style={{ paddingLeft: '40px', minHeight: '120px', resize: 'vertical' }} id="projectDescription" name="projectDescription" value={formData.projectDescription} onChange={handleInputChange} required disabled={isReadOnly} />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Timeline */}
                                <section className="card" style={{ opacity: isArchived ? 0.7 : 1 }}>
                                    <h3 style={{ margin: '0 0 1.25rem' }}>Operation Timeline</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Start Date</label>
                                            <div style={{ position: 'relative' }}>
                                                <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                                <input className="form-input" style={{ paddingLeft: '40px' }} type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} required disabled={isReadOnly} />
                                            </div>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">End Date</label>
                                            <div style={{ position: 'relative' }}>
                                                <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                                <input className="form-input" style={{ paddingLeft: '40px' }} type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} disabled={isReadOnly} />
                                            </div>
                                        </div>
                                    </div>

                                    <h3 style={{ margin: '0 0 1rem' }}>Research Fields</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                        {availableFields.map((field) => (
                                            <button
                                                key={field.id} type="button"
                                                onClick={() => !isArchived && toggleField(field.id)}
                                                className={`filter-chip ${selectedFieldIds.includes(field.id) ? 'active' : ''}`}
                                                style={{ cursor: isArchived ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: isArchived && !selectedFieldIds.includes(field.id) ? 0.5 : 1 }}
                                                disabled={isArchived}
                                            >
                                                {selectedFieldIds.includes(field.id) ? <Check size={14} /> : <Plus size={14} />} {field.name}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                {/* Action bar */}
                                <div className="card" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button type="button" onClick={() => setActiveTab('home')} className="btn btn-secondary" style={{ minWidth: '120px' }}>Cancel</button>
                                    <button onClick={handleSubmit} className="btn btn-primary" style={{ minWidth: '170px', opacity: isArchived ? 0.5 : 1, cursor: isArchived ? 'not-allowed' : 'pointer' }} disabled={submitting || isArchived}>
                                        {submitting ? 'Saving...' : <><Save size={18} /> Update Project</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right column — sidebar info (only for HOME or SETTINGS) */}
                    {(activeTab === 'home' || activeTab === 'settings') && (
                        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {activeTab === 'settings' ? (
                                <>
                                    {/* Project Timeline card */}
                                    <div className="card">
                                        <h4 style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Activity size={18} color="var(--accent-color)" /> Project Timeline
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <div className="avatar avatar-md" style={{ background: 'var(--border-light)', color: 'var(--text-secondary)' }}><User size={16} /></div>
                                                <div>
                                                    <p className="section-title" style={{ marginBottom: '2px' }}>Principal/Creator</p>
                                                    <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>
                                                        {project?.NameProjectCreator || project?.nameProjectCreator || project?.createdBy || 'System Admin'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <div className="avatar avatar-md" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><Calendar size={16} /></div>
                                                <div>
                                                    <p className="section-title" style={{ marginBottom: '2px' }}>Duration</p>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>
                                                        {formatProjectDate(project?.startDate)} — {formatProjectDate(project?.endDate, 'Ongoing')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                                                <div className="avatar avatar-md" style={{ background: 'var(--border-light)', color: 'var(--text-secondary)' }}><Clock size={16} /></div>
                                                <div>
                                                    <p className="section-title" style={{ marginBottom: '2px' }}>System Log</p>
                                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Created: {project?.createdAt ? new Date(project.createdAt).toLocaleString() : 'N/A'}</p>
                                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Modified: {project?.updatedAt ? new Date(project.updatedAt).toLocaleString() : 'Never'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="card" style={{
                                        background: canDeleteProject && !isArchived ? 'var(--danger-bg)' : 'var(--surface-hover)',
                                        border: '1px solid', borderColor: canDeleteProject && !isArchived ? '#FECACA' : 'var(--border-color)',
                                        opacity: !canDeleteProject || isArchived ? 0.8 : 1
                                    }}>
                                        <h4 style={{ margin: '0 0 0.75rem', color: canDeleteProject && !isArchived ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 700 }}>Delete Project</h4>
                                        {!canDeleteProject ? (
                                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 0 }}>Only the project's Principal/Lab Director or system administrators can permanently delete projects.</p>
                                        ) : isArchived ? (
                                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 0 }}>Archived projects are preserved for historical audit and cannot be deleted.</p>
                                        ) : (
                                            <>
                                                <p style={{ fontSize: '0.82rem', color: '#991B1B', lineHeight: 1.5, marginBottom: '1rem' }}>Once deleted, all tasks, files and data will be gone forever. This action is irreversible.</p>
                                                <button onClick={() => setIsDeleteConfirmOpen(true)} className="btn" style={{ width: '100%', background: 'var(--danger)', color: 'white', border: 'none' }}>
                                                    <Trash2 size={18} /> Delete Project
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div className="card" style={{ border: '1px solid var(--border-color)', background: 'white', padding: '1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(232,114,12,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8720C' }}>
                                                <Activity size={18} />
                                            </div>
                                            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Workspace Health</h4>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Project Roadmap Progress</span>
                                                    <span style={{ color: '#E8720C', fontWeight: 800 }}>{milestones.length > 0 ? Math.round((milestones.filter(m => m.status === MilestoneStatus.Completed).length / milestones.length) * 100) : 0}%</span>
                                                </div>
                                                <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${milestones.length > 0 ? (milestones.filter(m => m.status === MilestoneStatus.Completed).length / milestones.length) * 100 : 0}%`,
                                                        background: 'linear-gradient(90deg, #E8720C, #ff8c33)',
                                                        borderRadius: '5px',
                                                        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }} />
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{milestones.filter(m => m.status !== MilestoneStatus.Completed).length}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining Phases</div>
                                                </div>
                                                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{milestones.length}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Phases</div>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px dashed #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ACTIVITY COMPLETION</span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                        {tasks.filter(t => t.status === TaskStatus.Completed).length}/{tasks.length}
                                                    </span>
                                                </div>
                                                <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${tasks.length > 0 ? (tasks.filter(t => t.status === TaskStatus.Completed).length / tasks.length) * 100 : 0}%`,
                                                        background: '#94a3b8',
                                                        borderRadius: '2px'
                                                    }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </aside>
                    )}
                </div>
            </div>

            {/* ─── Modals ─────────────────────────────────────────────────── */}
            <TaskFormModal
                isOpen={isTaskModalOpen}
                onClose={() => {
                    setIsTaskModalOpen(false);
                    setEditingTask(null);
                }}
                onSubmit={handleTaskSubmit}
                projectMembers={members}
                task={editingTask}
                milestones={milestones}
                projectStartDate={project?.startDate as string | undefined}
                projectEndDate={project?.endDate as string | undefined}
                existingTasks={tasks}
                projectId={id || ''}
            />

            <TaskDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                taskId={selectedTaskId}
                projectMembers={members}
                milestones={milestones}
                onTaskUpdated={refetchTasks}
                projectStartDate={project?.startDate as string | undefined}
                projectEndDate={project?.endDate as string | undefined}
            />
            <Modal
                isOpen={isStatusConfirmOpen}
                onClose={() => setIsStatusConfirmOpen(false)}
                title="Status Transition"
                variant="info"
                footer={(
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsStatusConfirmOpen(false)}>Revert</button>
                        <button className="btn btn-primary" onClick={confirmStatusChange}>Confirm Transition</button>
                    </>
                )}
            >
                <div style={{ display: 'flex', gap: '16px' }}>
                    <AlertCircle size={32} color="var(--accent-color)" style={{ flexShrink: 0 }} />
                    <p style={{ margin: 0 }}>Transitioning to <strong>{ProjectStatus[pendingStatus || 0]}</strong>. This update will be propagated to all researchers.</p>
                </div>
            </Modal>
            <Modal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                title="Delete Project"
                variant="danger"
                footer={(
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</button>
                        <button className="btn" style={{ background: 'var(--danger)', color: 'white' }} onClick={handleDelete}>Delete Project</button>
                    </>
                )}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger)' }}>
                        <ShieldAlert size={28} /><strong style={{ fontSize: '1rem' }}>Confirm Deletion</strong>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>
                        You are about to permanently delete <strong>"{formData.projectName}"</strong>.
                        All research data, tasks, and audit trails will be irreversibly lost.
                    </p>
                </div>
            </Modal>
            <MilestoneFormModal
                isOpen={isMilestoneModalOpen}
                onClose={() => {
                    setIsMilestoneModalOpen(false);
                    setEditingMilestone(null);
                }}
                onSubmit={handleMilestoneSubmit}
                milestone={editingMilestone}
                existingMilestones={milestones}
                projectStartDate={project.startDate || undefined}
                projectEndDate={project.endDate || undefined}
            />

            <MilestoneDetailModal
                isOpen={isMilestoneDetailOpen}
                onClose={() => setIsMilestoneDetailOpen(false)}
                milestoneId={selectedMilestoneId}
                onMilestoneUpdated={refetchMilestones}
                canManage={canManageMilestones}
                projectId={id || ''}
                projectMembers={members}
                milestones={milestones}
                projectStartDate={project?.startDate as string | undefined}
                projectEndDate={project?.endDate as string | undefined}
            />

            <AddMemberModal
                isOpen={isAddMemberModalOpen}
                onClose={() => setIsAddMemberModalOpen(false)}
                projectId={id || ''}
                hasLeader={hasLeader}
                currentProjectRole={Number(projectRoleValue)}
                existingMemberIds={members.map(m => m.userId || m.id)}
                onSuccess={() => {
                    refetchMembers();
                    showToast('Member added to project successfully!', 'success');
                }}
            />

            <Modal
                isOpen={isMemberDeleteConfirmOpen}
                onClose={() => setIsMemberDeleteConfirmOpen(false)}
                title="Remove Member"
                variant="danger"
                footer={(
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsMemberDeleteConfirmOpen(false)}>Cancel</button>
                        <button className="btn" style={{ background: 'var(--danger)', color: 'white' }} onClick={handleRemoveMember}>Remove Member</button>
                    </>
                )}
            >
                <div>
                    <p>Are you sure you want to remove <strong>{selectedMemberForDelete?.fullName || selectedMemberForDelete?.userName}</strong> from this project?</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '1rem' }}>They will lose access to all research activities and data in this workspace.</p>
                </div>
            </Modal>

            <MemberDetailModal
                isOpen={isMemberDetailModalOpen}
                onClose={() => {
                    setIsMemberDetailModalOpen(false);
                    setSelectedMember(null);
                }}
                member={selectedMember}
                projectId={id || ''}
                currentUser={currentUser}
                currentUserProjectRole={Number(projectRoleValue)}
                canManage={canManageProject}
                onSuccess={() => {
                    refetchMembers();
                    showToast('Project team updated.', 'success');
                }}
            />
        </MainLayout>
    );
};

export default ProjectDetails;
