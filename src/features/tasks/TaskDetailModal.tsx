import React, { useState, useEffect, useMemo } from 'react';
import MilestoneRoadmapPreview from '../milestones/MilestoneRoadmapPreview';
import {
    X,
    Activity,
    Users,
    Search,
    FileText,
    Save,
    AlertCircle,
    Trash2,
    MapPin,
    Plus,
    File,
    Eye
} from 'lucide-react';
import { Task, TaskStatus, Priority, ProjectRoleEnum, ProjectMember, TaskEvidence } from '@/types';
import { taskService, projectService, milestoneService, membershipService } from '@/services';
import { API_BASE_URL } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import Toast from '@/components/common/Toast';
import ConfirmModal from '@/components/common/ConfirmModal';

import { Milestone, MilestoneStatus } from '@/types/milestone';

interface TaskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    taskId: string | null;
    projectMembers?: ProjectMember[];
    milestones?: Milestone[];
    onTaskUpdated?: () => void;
    projectStartDate?: string;
    projectEndDate?: string;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
    isOpen,
    onClose,
    taskId,
    projectMembers,
    milestones,
    onTaskUpdated,
    projectStartDate,
    projectEndDate,
}) => {
    const { user: currentUser } = useAuth();
    const [task, setTask] = useState<Task | null>(null);
    const [projectRole, setProjectRole] = useState<number | null>(null);
    const [currentMember, setCurrentMember] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Internal data states for when props aren't provided
    const [internalMembers, setInternalMembers] = useState<ProjectMember[]>([]);
    const [internalMilestones, setInternalMilestones] = useState<Milestone[]>([]);
    const [fetchedMilestone, setFetchedMilestone] = useState<Milestone | null>(null);
    const [milestoneTasks, setMilestoneTasks] = useState<Task[]>([]);


    // Determine which data to use (prop vs internal)
    const effectiveMembers = (projectMembers && projectMembers.length > 0) ? projectMembers : internalMembers;
    const baseMilestones = (milestones && milestones.length > 0) ? milestones : internalMilestones;
    const effectiveMilestones = useMemo(() => {
        let list = baseMilestones.filter(m =>
            m.status === MilestoneStatus.NotStarted ||
            m.status === MilestoneStatus.InProgress ||
            (task && String(m.milestoneId) === String((task as any).milestoneId || (task as any).milestone?.id))
        );

        if (fetchedMilestone && !list.some(m => String(m.milestoneId).toLowerCase() === String(fetchedMilestone.milestoneId).toLowerCase())) {
            return [fetchedMilestone, ...list];
        }
        return list;
    }, [baseMilestones, fetchedMilestone, task]);

    // Form State (mirrors TaskFormModal)
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<Priority>(Priority.Medium);
    const [status, setStatus] = useState<TaskStatus>(TaskStatus.Todo);
    const [milestoneId, setMilestoneId] = useState<string>('');
    const [memberId, setMemberId] = useState<string>('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [supportMemberIds, setSupportMemberIds] = useState<string[]>([]);
    const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
    const [serverEvidences, setServerEvidences] = useState<TaskEvidence[]>([]);
    const [memberSearchTerm, setMemberSearchTerm] = useState('');

    // Milestone search and filter states
    const [milestoneSearchTerm, setMilestoneSearchTerm] = useState('');
    const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<string>('all');

    // Custom Notifications & Confirmations
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'info' | 'danger' | 'success';
        confirmText?: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'info',
        onConfirm: () => { }
    });

    const isAdmin = currentUser && (Number(currentUser.role) === 1 || currentUser.role === 'Admin');
    const isAuthorizedToEdit = isAdmin ||
        projectRole === ProjectRoleEnum.Leader ||
        projectRole === ProjectRoleEnum.LabDirector;

    // Permissions for Evidence Upload
    const isTaskMember = useMemo(() => {
        if (!task || !currentUser) return false;

        const currentUserId = (currentUser as any).userId || (currentUser as any).id || "";
        const myMemberId = currentMember?.memberId || currentMember?.id;

        // Check if primary member
        const isPrimary = task.memberId === currentUserId ||
            (myMemberId && task.memberId === myMemberId) ||
            task.member?.userId === currentUserId ||
            task.members?.some(m => m.userId === currentUserId && (m.memberId === task.memberId || m.membershipId === task.memberId));

        // Check if in collaborators list
        const isSupport = task.members?.some((m: any) =>
            m.userId === currentUserId ||
            (myMemberId && (m.memberId === myMemberId || m.membershipId === myMemberId))
        );

        return isPrimary || isSupport;
    }, [currentUser, task, currentMember]);

    const canUploadEvidence = isAuthorizedToEdit || isTaskMember;

    useEffect(() => {
        if (!isOpen || !taskId) return;

        const fetchTask = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await taskService.getById(taskId);
                if (data) {
                    setTask(data);

                    // Populate Form State
                    setName(data.name || '');
                    setDescription(data.description || '');
                    setPriority(data.priority);
                    setStatus(data.status);

                    // Robust Milestone ID extraction
                    const mid = (data as any).milestoneId || (data as any).milestoneID || (data as any).milestone_id || ((data as any).milestone && ((data as any).milestone.id || (data as any).milestone.ID)) || '';
                    setMilestoneId(mid);

                    // Proactively fetch the specific milestone and its tasks
                    if (mid) {
                        milestoneService.getById(mid).then(setFetchedMilestone).catch(() => { });
                        milestoneService.getTasksByMilestone(mid).then(tasks => {
                            console.log('[Roadmap] Fetched milestone tasks:', tasks?.length, tasks);
                            setMilestoneTasks(tasks || []);
                        }).catch(() => setMilestoneTasks([]));
                    } else {
                        setFetchedMilestone(null);
                        setMilestoneTasks([]);
                    }

                    setMemberId(data.memberId || '');
                    setStartDate(data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '');
                    setDueDate(data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : '');
                    setSupportMemberIds(data.members?.map((m: any) => m.memberId || m.id) || []);
                    setIsEditMode(false); // Default to read-only
                    setEvidenceFiles([]);

                    if (data.projectId) {
                        const [memberInfo, projMembers, projMilestones] = await Promise.all([
                            projectService.getCurrentMember(data.projectId),
                            (projectMembers && projectMembers.length > 0) ? Promise.resolve(null) : membershipService.getProjectMembers(data.projectId),
                            (milestones && milestones.length > 0) ? Promise.resolve(null) : milestoneService.getByProject(data.projectId)
                        ]);

                        setProjectRole(memberInfo?.projectRole || null);
                        setCurrentMember(memberInfo);
                        if (projMembers) setInternalMembers(projMembers);
                        if (projMilestones) setInternalMilestones(projMilestones);


                        // Fetch evidences
                        const evidences = await taskService.getEvidences(taskId);
                        setServerEvidences(evidences || []);
                    }
                } else {
                    setError("Activity not found.");
                }
            } catch (err) {
                console.error("Failed to load task details:", err);
                setError("Failed to load task details.");
            } finally {
                setLoading(false);
            }
        };

        fetchTask();
    }, [isOpen, taskId]);

    const filteredMembers = useMemo(() => {
        // Rule 1: Filter out Lab Directors unless they are already assigned to this task
        const list = effectiveMembers.filter(m => {
            const mId = m.memberId || m.id || m.userId || '';
            const isActive = mId === memberId || supportMemberIds.includes(mId);
            const isLD = m.projectRole === ProjectRoleEnum.LabDirector ||
                m.projectRoleName === 'Lab Director' ||
                m.roleName === 'Lab Director';
            return !isLD || isActive;
        });

        if (!memberSearchTerm.trim()) return list;
        const term = memberSearchTerm.toLowerCase();
        return list.filter(m =>
            (m.fullName || m.userName || '').toLowerCase().includes(term)
        );
    }, [effectiveMembers, memberSearchTerm, memberId, supportMemberIds]);

    const filteredMilestones = useMemo(() => {
        let list = effectiveMilestones;

        // Always include the currently selected milestone in the list even if it doesn't match filters
        const currentMilestone = effectiveMilestones.find(m => {
            const mId = String(m.milestoneId || (m as any).id || (m as any).ID || '').toLowerCase();
            const targetId = String(milestoneId).toLowerCase();
            return mId === targetId && targetId !== '';
        });

        // Filter by status
        if (milestoneStatusFilter !== 'all') {
            list = list.filter(m => m.status === Number(milestoneStatusFilter));
        }

        // Search by name
        if (milestoneSearchTerm.trim()) {
            const term = milestoneSearchTerm.toLowerCase();
            list = list.filter(m => m.name.toLowerCase().includes(term));
        }

        // Re-inject current milestone if it was filtered out but is active
        if (currentMilestone && !list.some(m => m.milestoneId === milestoneId)) {
            list = [currentMilestone, ...list];
        }

        return list;
    }, [effectiveMilestones, milestoneSearchTerm, milestoneStatusFilter, milestoneId]);

    const getMilestoneStatusLabel = (status: MilestoneStatus) => {
        switch (status) {
            case MilestoneStatus.NotStarted: return 'Not Started';
            case MilestoneStatus.InProgress: return 'In Progress';
            case MilestoneStatus.Completed: return 'Completed';
            case MilestoneStatus.OnHold: return 'On Hold';
            case MilestoneStatus.Cancelled: return 'Cancelled';
            default: return 'Unknown';
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr || dateStr.startsWith('0001')) return 'N/A';
        return new Date(dateStr).toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit', year: 'numeric' });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB

            const oversizedFiles = files.filter(f => f.size > MAX_SIZE);
            if (oversizedFiles.length > 0) {
                setToast({
                    message: `Skipped ${oversizedFiles.length} file(s) larger than 10MB.`,
                    type: 'error'
                });
            }

            const validFiles = files.filter(f => f.size <= MAX_SIZE);
            if (validFiles.length > 0) {
                setEvidenceFiles(prev => [...prev, ...validFiles]);
            }
        }
    };

    const removeFile = (index: number) => {
        setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
    };

    const toggleSupportMember = (id: string) => {
        if (isEditMode) {
            // Rule 2: A member cannot be both assignee and collaborator
            if (id === memberId) return;

            if (supportMemberIds.includes(id)) {
                setSupportMemberIds(supportMemberIds.filter(mId => mId !== id));
            } else {
                setSupportMemberIds([...supportMemberIds, id]);
            }
        }
    };

    const extractErrorMessage = (err: any, fallback: string) => {
        if (err.response?.data?.message) return err.response.data.message;
        if (err.message) return err.message;
        return fallback;
    };

    const handleDelete = async () => {
        if (!taskId) return;

        setConfirmConfig({
            isOpen: true,
            title: 'Delete Activity',
            message: 'Are you sure you want to delete this activity? This action cannot be undone and all associated records will be removed.',
            variant: 'danger',
            confirmText: 'Delete Forever',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await taskService.delete(taskId);
                    setToast({ message: "Activity deleted successfully", type: 'success' });
                    setTimeout(() => {
                        onTaskUpdated?.();
                        onClose();
                    }, 500);
                } catch (err: any) {
                    console.error("Failed to delete task:", err);
                    setToast({ message: extractErrorMessage(err, "Failed to delete activity. Please try again."), type: 'error' });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const getFullUrl = (url: string) => {
        if (!url) return '#';
        let fullUrl = url;

        if (!url.startsWith('http')) {
            // Handle Windows style paths and relative paths
            const cleanPath = url.replace(/\\/g, '/');
            const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
            const path = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
            fullUrl = `${baseUrl}${path}`;
        }

        // For Office documents, use Microsoft Online Viewer to "open" instead of download
        const lowerUrl = fullUrl.toLowerCase();
        const officeExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
        if (officeExtensions.some(ext => lowerUrl.endsWith(ext))) {
            return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fullUrl)}`;
        }

        return fullUrl;
    };

    // Helper to truncate long filenames 
    const truncateFilename = (name: string, maxLength: number = 30) => {
        if (!name || name.length <= maxLength) return name;
        const extension = name.split('.').pop();
        const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
        const truncated = nameWithoutExt.substring(0, maxLength - 5 - (extension?.length || 0)) + '...';
        return extension ? `${truncated}.${extension}` : truncated;
    };

    const handleStatusTransition = async (newStatus: TaskStatus) => {
        if (!taskId) return;

        // Validate evidence specifically for Submitted status
        if (newStatus === TaskStatus.Submitted && serverEvidences.length === 0 && evidenceFiles.length === 0) {
            setToast({ message: 'Activities must have at least one evidence file before being submitted.', type: 'error' });
            return;
        }

        // Validate assignee specifically for InProgress status
        if (newStatus === TaskStatus.InProgress && !memberId) {
            setToast({ message: 'Research activity must have an assignee before starting.', type: 'error' });
            return;
        }

        const statusLabel = getStatusActionLabel(newStatus);

        setConfirmConfig({
            isOpen: true,
            title: 'Update Status',
            message: newStatus === TaskStatus.InProgress
                ? 'Do you want to start this research activity? The status will be changed to "On-going".'
                : `Do you want to change the activity status to "${getStatusActionLabel(newStatus)}"? This may restrict certain actions based on the new status.`,
            variant: 'info',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await taskService.updateStatus(taskId, newStatus);
                    onTaskUpdated?.();

                    // Refresh local state
                    const updated = await taskService.getById(taskId);
                    if (updated) {
                        setTask(updated);
                        setStatus(updated.status);
                    }
                    setToast({ message: `Status updated to ${statusLabel}`, type: 'success' });
                } catch (err: any) {
                    console.error("Failed to update status:", err);
                    setToast({ message: extractErrorMessage(err, "Failed to update activity status. Please try again."), type: 'error' });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const nextStatuses = useMemo(() => {
        if (!task) return [];
        switch (task.status) {
            case TaskStatus.Todo: return [TaskStatus.InProgress];
            case TaskStatus.InProgress: return [TaskStatus.Submitted];
            case TaskStatus.Submitted: return [TaskStatus.Completed, TaskStatus.Adjusting];
            case TaskStatus.Missed: return [TaskStatus.Submitted];
            case TaskStatus.Adjusting: return [TaskStatus.Completed, TaskStatus.InProgress];
            case TaskStatus.Completed: return [];
            default: return [];
        }
    }, [task?.status]);

    const getStatusActionLabel = (s: TaskStatus) => {
        switch (s) {
            case TaskStatus.Todo: return "Todo";
            case TaskStatus.InProgress: return "On-going";
            case TaskStatus.Submitted: return "Submitted";
            case TaskStatus.Missed: return "Missed";
            case TaskStatus.Adjusting: return "Adjusting";
            case TaskStatus.Completed: return "Completed";
            default: return "Update";
        }
    };



    const getTaskStatusStyle = (s: TaskStatus) => {
        switch (s) {
            case TaskStatus.Todo: return { text: '#64748b', bg: '#f1f5f9', label: 'Draft' };
            case TaskStatus.InProgress: return { text: '#2563eb', bg: '#eff6ff', label: 'On-going' };
            case TaskStatus.Submitted: return { text: '#7c3aed', bg: '#f5f3ff', label: 'Submitted' };
            case TaskStatus.Missed: return { text: '#ef4444', bg: '#fef2f2', label: 'Missed' };
            case TaskStatus.Adjusting: return { text: '#ea580c', bg: '#fff7ed', label: 'Adjusting' };
            case TaskStatus.Completed: return { text: '#16a34a', bg: '#f0fdf4', label: 'Completed' };
            default: return { text: '#64748b', bg: '#f1f5f9', label: 'Unknown' };
        }
    };

    const handleDeleteEvidence = async (evidenceId: number) => {
        if (!taskId) return;

        setConfirmConfig({
            isOpen: true,
            title: 'Remove Evidence',
            message: 'Are you sure you want to remove this evidence file? This cannot be undone.',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await taskService.deleteEvidence(taskId, evidenceId);
                    setServerEvidences(prev => prev.filter(e => e.id !== evidenceId));
                    setToast({ message: "Evidence removed", type: 'success' });
                } catch (err: any) {
                    console.error("Failed to delete evidence:", err);
                    setToast({ message: extractErrorMessage(err, "Failed to remove evidence. Please check if the file still exists on server."), type: 'error' });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskId) return;

        // Validate evidence specifically for Submitted status
        if (status === TaskStatus.Submitted && serverEvidences.length === 0 && evidenceFiles.length === 0) {
            setToast({ message: 'Activities must have at least one evidence file before being submitted.', type: 'error' });
            return;
        }

        // Validate assignee specifically for InProgress status
        if (status === TaskStatus.InProgress && !memberId) {
            setToast({ message: 'Research activity must have an assignee before starting (On-going status).', type: 'error' });
            return;
        }

        // Validate dates are within milestone range
        if (milestoneId) {
            const milestone = effectiveMilestones.find(m => String(m.milestoneId) === String(milestoneId));
            if (milestone && milestone.startDate && milestone.dueDate) {
                const mStart = new Date(milestone.startDate).getTime();
                const mEnd = new Date(milestone.dueDate).getTime();

                // If only startDate is provided, use it as baseline
                const tStart = startDate ? new Date(startDate).getTime() : null;
                const tEnd = dueDate ? new Date(dueDate).getTime() : (tStart || null);

                if ((tStart && tStart < mStart) || (tEnd && tEnd > mEnd)) {
                    const formatDateStr = (d: string) => new Date(d).toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' });
                    setToast({
                        message: `Activity dates must be within milestone period: ${formatDateStr(milestone.startDate)} - ${formatDateStr(milestone.dueDate)}`,
                        type: 'error'
                    });
                    return;
                }
            }
        }

        // Helper to perform the actual save
        const performSave = async () => {
            try {
                setLoading(true);
                const taskData: any = {
                    name,
                    description,
                    priority,
                    status,
                    milestoneId: milestoneId || null,
                    memberId: memberId || null,
                    startDate: startDate ? new Date(startDate).toISOString() : null,
                    dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                    supportMembers: supportMemberIds,
                    evidence: evidenceFiles
                };

                await taskService.update(taskId, { ...taskData, projectId: task?.projectId });
                setEvidenceFiles([]);

                onTaskUpdated?.();
                setIsEditMode(false);
                setToast({ message: isEditMode ? "Activity updated successfully" : "Evidence uploaded successfully", type: 'success' });

                // Refresh local state and form states to ensure consistency
                const updated = await taskService.getById(taskId);
                if (updated) {
                    setTask(updated);
                    // Update form state with new data
                    setName(updated.name || '');
                    setDescription(updated.description || '');
                    setPriority(updated.priority);
                    setStatus(updated.status);
                    setMilestoneId(updated.milestoneId || '');
                    setMemberId(updated.memberId || '');
                    setStartDate(updated.startDate ? new Date(updated.startDate).toISOString().split('T')[0] : '');
                    setDueDate(updated.dueDate ? new Date(updated.dueDate).toISOString().split('T')[0] : '');

                    // Refresh evidences
                    const evidences = await taskService.getEvidences(taskId);
                    setServerEvidences(evidences || []);
                }
            } catch (err: any) {
                console.error("Failed to update task:", err);
                setToast({ message: extractErrorMessage(err, "Failed to update activity. Please try again."), type: 'error' });
            } finally {
                setLoading(false);
            }
        };

        // Confirmation for evidence upload if not in edit mode
        if (!isEditMode && evidenceFiles.length > 0) {
            setConfirmConfig({
                isOpen: true,
                title: 'Upload Evidence',
                message: `Are you sure you want to upload ${evidenceFiles.length} evidence file(s)?`,
                variant: 'info',
                onConfirm: performSave
            });
        } else {
            performSave();
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
        }}>
            <div style={{
                background: 'white', borderRadius: '24px', width: '100%',
                maxWidth: '1200px', maxHeight: '95vh',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem 2rem', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            padding: '10px', background: isEditMode ? 'var(--primary-color)' : '#64748b',
                            borderRadius: '12px', color: 'white'
                        }}>
                            <Activity size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
                                {isEditMode ? 'Edit Research Activity' : 'Research Activity Detail'}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ID: {taskId?.slice(-8).toUpperCase()}</p>
                                {task && (
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        background: getTaskStatusStyle(task.status).bg,
                                        color: getTaskStatusStyle(task.status).text,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {getTaskStatusStyle(task.status).label}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {/* Edit Mode Toggle */}
                        {isAuthorizedToEdit && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '6px 14px', borderRadius: '30px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isEditMode ? 'var(--primary-color)' : '#64748b' }}>
                                    {isEditMode ? 'EDITING MODE' : 'VIEW MODE'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isEditMode) {
                                            if (task) {
                                                setName(task.name || '');
                                                setDescription(task.description || '');
                                                setPriority(task.priority);
                                                setStatus(task.status);
                                                setMilestoneId((task as any).milestoneId || (task as any).milestoneID || (task as any).milestone_id || (task as any).milestone?.id || '');
                                                setMemberId(task.memberId || '');
                                                setStartDate(task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
                                                setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
                                                // CRITICAL: Use memberId (membershipId) for the state, NOT the TaskMember record id
                                                setSupportMemberIds(task.members?.map((m: any) => m.memberId || m.membershipId) || []);

                                                // If we don't have members or milestones, fetch them for this task's project
                                                if (task.projectId) {
                                                    if (!projectMembers) {
                                                        membershipService.getProjectMembers(task.projectId).then(setInternalMembers);
                                                    }
                                                    if (!milestones) {
                                                        milestoneService.getByProject(task.projectId).then(setInternalMilestones);
                                                    }
                                                }
                                            }
                                        }
                                        setIsEditMode(!isEditMode);
                                    }}
                                    style={{
                                        width: '44px', height: '22px', borderRadius: '11px',
                                        background: isEditMode ? 'var(--primary-color)' : '#cbd5e1',
                                        position: 'relative', border: 'none', cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div style={{
                                        width: '18px', height: '18px', borderRadius: '50%',
                                        background: 'white', position: 'absolute', top: '2px',
                                        left: isEditMode ? '24px' : '2px', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                    }} />
                                </button>
                            </div>
                        )}

                        <button
                            onClick={onClose}
                            style={{ border: 'none', background: '#f8fafc', cursor: 'pointer', color: '#64748b', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Roadmap Preview - Context focused on sibling activities within the same milestone */}
                {(() => {
                    // 1. Get current Milestone Context
                    const currentMid = (task as any)?.milestoneId || (task as any)?.milestone?.id || milestoneId;
                    const milestoneContext = effectiveMilestones.find(m => String(m.milestoneId || (m as any).id || (m as any).ID || '').toLowerCase() === String(currentMid).toLowerCase()) || fetchedMilestone;

                    // If we don't have a milestone ID, we don't show the roadmap
                    if (!currentMid) return null;

                    // 2. Determine Timeline Bounds (Milestone dates, with Project dates as fallback)
                    const roadmapStart = milestoneContext?.startDate || projectStartDate;
                    const roadmapEnd = milestoneContext?.dueDate || projectEndDate;

                    // 3. Source Sibling Activities — ONLY from getTasksByMilestone API
                    const siblingTasks = milestoneTasks.filter(t => {
                        const tId = String(t.taskId || (t as any).id || (t as any).ID || '').toLowerCase();
                        const currentTaskId = String(taskId || '').toLowerCase();
                        return tId !== currentTaskId; // Exclude the current task
                    });

                    return (
                        <div style={{
                            background: '#f8fafc',
                            borderBottom: '2px solid #e2e8f0',
                            flexShrink: 0,
                            position: 'relative',
                            zIndex: 10
                        }}>
                            <MilestoneRoadmapPreview
                                existingMilestones={siblingTasks.map(t => ({
                                    id: t.taskId,
                                    name: t.name,
                                    startDate: t.startDate || "",
                                    dueDate: t.dueDate || "",
                                    description: t.description || "",
                                    status: Number(t.status)
                                }))}
                                currentMilestones={name && startDate && dueDate ? [{
                                    id: taskId || 'new',
                                    name: name,
                                    startDate: startDate,
                                    dueDate: dueDate
                                }] : (task?.startDate && task?.dueDate ? [{
                                    id: task.taskId,
                                    name: task.name,
                                    startDate: task.startDate,
                                    dueDate: task.dueDate
                                }] : [])}
                                projectStartDate={roadmapStart}
                                projectEndDate={roadmapEnd}
                                highlightId={taskId || undefined}
                            />
                        </div>
                    );
                })()}

                {/* Body - Main Content Layout */}
                <form onSubmit={handleSave} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {loading && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="loader"></div>
                        </div>
                    )}

                    {error ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: '1rem' }}>
                            <AlertCircle size={48} color="#ef4444" />
                            <h3 style={{ margin: 0, color: '#1e293b' }}>Error Loading Activity</h3>
                            <p style={{ margin: 0, color: '#64748b' }}>{error}</p>
                            <button type="button" onClick={onClose} className="btn btn-secondary">Go Back</button>
                        </div>
                    ) : (
                        <>
                            <div style={{ flex: 1.2, padding: '2rem', overflowY: 'auto', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity Name</label>
                                    <input
                                        required
                                        disabled={!isEditMode}
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        style={{
                                            padding: '0.85rem 1.15rem', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                            fontSize: '1rem', outline: 'none', transition: 'all 0.2s',
                                            background: isEditMode ? 'white' : '#f8fafc',
                                            borderColor: isEditMode ? 'var(--primary-color)' : '#e2e8f0',
                                            fontWeight: isEditMode ? 600 : 700,
                                            color: '#1e293b'
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                                    <textarea
                                        rows={6}
                                        disabled={!isEditMode}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        style={{
                                            padding: '0.85rem 1.15rem', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                            fontSize: '0.95rem', resize: 'none', outline: 'none', lineHeight: 1.6,
                                            background: isEditMode ? 'white' : '#f8fafc',
                                            color: '#334155'
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Priority Level</label>
                                        <select
                                            disabled={!isEditMode}
                                            value={priority}
                                            onChange={(e) => setPriority(Number(e.target.value))}
                                            style={{ padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: isEditMode ? 'white' : '#f8fafc', fontWeight: 600 }}
                                        >
                                            <option value={Priority.Low}>Low</option>
                                            <option value={Priority.Medium}>Medium</option>
                                            <option value={Priority.High}>High</option>
                                            <option value={Priority.Critical}>Critical</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current Status</label>
                                        <select
                                            disabled={!isEditMode}
                                            value={status}
                                            onChange={(e) => setStatus(Number(e.target.value))}
                                            style={{ padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: isEditMode ? 'white' : '#f8fafc', fontWeight: 600 }}
                                        >
                                            <option value={TaskStatus.Todo}>To Do</option>
                                            <option value={TaskStatus.InProgress}>In Progress</option>
                                            <option value={TaskStatus.Submitted}>Submitted</option>
                                            <option value={TaskStatus.Missed}>Missed</option>
                                            <option value={TaskStatus.Adjusting}>Adjusting</option>
                                            <option value={TaskStatus.Completed}>Completed</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <MapPin size={14} color="#E8720C" /> Associated Milestone
                                    </label>
                                    {isEditMode ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'white', padding: '1rem', borderRadius: '16px', border: '1.5px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search milestone..."
                                                        value={milestoneSearchTerm}
                                                        onChange={(e) => setMilestoneSearchTerm(e.target.value)}
                                                        style={{ width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.8rem', outline: 'none' }}
                                                    />
                                                </div>
                                                <select
                                                    value={milestoneStatusFilter}
                                                    onChange={(e) => setMilestoneStatusFilter(e.target.value)}
                                                    style={{ padding: '0.6rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.8rem', color: '#475569', fontWeight: 600, outline: 'none' }}
                                                >
                                                    <option value="all">All Status</option>
                                                    <option value={MilestoneStatus.NotStarted.toString()}>Not Started</option>
                                                    <option value={MilestoneStatus.InProgress.toString()}>In Progress</option>
                                                    <option value={MilestoneStatus.Completed.toString()}>Completed</option>
                                                </select>
                                            </div>

                                            <select
                                                value={milestoneId}
                                                onChange={(e) => setMilestoneId(e.target.value)}
                                                style={{ padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 600, fontSize: '0.9rem' }}
                                            >
                                                <option value="">No Milestone Linked</option>
                                                {filteredMilestones.map(m => (
                                                    <option key={m.milestoneId} value={m.milestoneId}>
                                                        [{getMilestoneStatusLabel(m.status)}] {m.name} ({formatDate(m.startDate)} - {formatDate(m.dueDate)})
                                                    </option>
                                                ))}
                                            </select>
                                            {filteredMilestones.length === 0 && milestoneSearchTerm && (
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#ef4444', fontStyle: 'italic' }}>No milestones match your search.</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '0.85rem 1.15rem', borderRadius: '12px', background: '#f8fafc', border: '1.5px solid #f1f5f9', fontWeight: 700, color: '#1e293b' }}>
                                            {effectiveMilestones.find(m => {
                                                const mId = String(m.milestoneId || (m as any).id || (m as any).ID || '').toLowerCase();
                                                const targetId = String(milestoneId).toLowerCase();
                                                return mId === targetId && targetId !== '';
                                            })?.name || (task as any)?.milestone?.name || 'No Associated Milestone'}
                                        </div>
                                    )}
                                </div>

                                {(() => {
                                    const milestone = effectiveMilestones.find(m => String(m.milestoneId || (m as any).id || (m as any).ID || '').toLowerCase() === String(milestoneId).toLowerCase());
                                    const minVal = milestone?.startDate ? new Date(milestone.startDate).toISOString().split('T')[0] : undefined;
                                    const maxVal = milestone?.dueDate ? new Date(milestone.dueDate).toISOString().split('T')[0] : undefined;
                                    const msStart = minVal ? new Date(minVal).getTime() : null;
                                    const msEnd = maxVal ? new Date(maxVal).getTime() : null;
                                    const tStart = startDate ? new Date(startDate).getTime() : null;
                                    const tEnd = dueDate ? new Date(dueDate).getTime() : null;

                                    const isStartInvalid = msStart && tStart && tStart < msStart || msEnd && tStart && tStart > msEnd;
                                    const isDueInvalid = msStart && tEnd && tEnd < msStart || msEnd && tEnd && tEnd > msEnd;

                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: isStartInvalid ? '#ef4444' : '#64748b', textTransform: 'uppercase' }}>
                                                    Start Date {isStartInvalid && ' (Out of Range)'}
                                                </label>
                                                <input
                                                    type="date"
                                                    disabled={!isEditMode}
                                                    value={startDate}
                                                    min={minVal}
                                                    max={maxVal}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    style={{
                                                        padding: '0.85rem 1.15rem', borderRadius: '12px',
                                                        border: isStartInvalid ? '2px solid #ef4444' : '1.5px solid #e2e8f0',
                                                        background: isEditMode ? (isStartInvalid ? '#fff1f2' : 'white') : '#f8fafc'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: isDueInvalid ? '#ef4444' : '#64748b', textTransform: 'uppercase' }}>
                                                    Deadline {isDueInvalid && ' (Out of Range)'}
                                                </label>
                                                <input
                                                    type="date"
                                                    disabled={!isEditMode}
                                                    value={dueDate}
                                                    min={startDate || minVal}
                                                    max={maxVal}
                                                    onChange={(e) => setDueDate(e.target.value)}
                                                    style={{
                                                        padding: '0.85rem 1.15rem', borderRadius: '12px',
                                                        border: isDueInvalid ? '2px solid #ef4444' : '1.5px solid #e2e8f0',
                                                        background: isEditMode ? (isDueInvalid ? '#fff1f2' : 'white') : '#f8fafc'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div style={{
                                    marginTop: 'auto', padding: '1.5rem', background: '#f8fafc',
                                    borderRadius: '16px', border: '1.5px dashed #cbd5e1',
                                    display: 'flex', flexDirection: 'column', gap: '12px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FileText size={18} color="var(--primary-color)" /> SUBMIT EVIDENCE
                                        </label>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>MAX 10MB PER FILE</span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {/* Existing Server Evidences */}
                                        {serverEvidences.length > 0 && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                                {serverEvidences.map((ev) => (
                                                    <a
                                                        key={ev.id}
                                                        href={getFullUrl(ev.fileUrl || ev.url || '')}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px',
                                                            background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px',
                                                            cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                                            textDecoration: 'none'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.borderColor = 'var(--primary-color)';
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                                                        }}
                                                    >
                                                        <div style={{
                                                            padding: '10px', background: '#eff6ff', borderRadius: '10px', color: 'var(--primary-color)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            <File size={20} />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p
                                                                style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                                title={ev.fileName || ev.name || 'Unnamed File'}
                                                            >
                                                                {truncateFilename(ev.fileName || ev.name || 'Unnamed File', 35)}
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>
                                                                Uploaded {new Date(ev.submittedAt || ev.createdDate || Date.now()).toLocaleDateString('vi-VN')}
                                                            </p>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    window.open(getFullUrl(ev.fileUrl || ev.url || ''), '_blank');
                                                                }}
                                                                style={{
                                                                    border: 'none', background: '#f8fafc', color: '#64748b',
                                                                    cursor: 'pointer', width: '32px', height: '32px', borderRadius: '8px',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                title="View File"
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                            {task && ![TaskStatus.Todo, TaskStatus.Submitted, TaskStatus.Completed, TaskStatus.Adjusting].includes(task.status) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        handleDeleteEvidence(ev.id);
                                                                    }}
                                                                    style={{
                                                                        border: 'none', background: '#fff1f2', color: '#ef4444',
                                                                        cursor: 'pointer', width: '32px', height: '32px', borderRadius: '8px',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                    }}
                                                                    title="Delete File"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        )}

                                        {/* New Selected Files */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                                            {evidenceFiles.map((file, i) => (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
                                                    background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px',
                                                    fontSize: '0.8rem', fontWeight: 600, color: '#475569'
                                                }}>
                                                    <FileText size={18} color="#94a3b8" />
                                                    <span
                                                        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                        title={file.name}
                                                    >
                                                        {truncateFilename(file.name, 30)}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                    {task && ![TaskStatus.Todo, TaskStatus.Submitted, TaskStatus.Completed, TaskStatus.Adjusting].includes(task.status) && (
                                                        <button type="button" onClick={() => removeFile(i)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: '4px' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}

                                            {!canUploadEvidence ? (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                                    padding: '12px 20px', background: '#f8fafc', color: '#94a3b8',
                                                    borderRadius: '14px', border: '1px solid #e2e8f0',
                                                    fontSize: '0.8rem', fontWeight: 600, marginTop: '4px'
                                                }}>
                                                    <AlertCircle size={16} /> Only assigned members can upload evidence
                                                </div>
                                            ) : task && ![TaskStatus.Todo, TaskStatus.Submitted, TaskStatus.Completed, TaskStatus.Adjusting].includes(task.status) ? (
                                                <label style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                                    padding: '12px 20px', background: 'white', color: 'var(--primary-color)',
                                                    borderRadius: '14px', border: '2px dashed #e2e8f0',
                                                    fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                                                    marginTop: '4px'
                                                }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = 'var(--primary-color)';
                                                        e.currentTarget.style.background = '#eff6ff';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                                        e.currentTarget.style.background = 'white';
                                                    }}
                                                >
                                                    <Plus size={18} /> Add Research Evidence Files
                                                    <input type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                                                </label>
                                            ) : (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                                    padding: '12px 20px', background: '#f8fafc', color: '#94a3b8',
                                                    borderRadius: '14px', border: '1px solid #e2e8f0',
                                                    fontSize: '0.8rem', fontWeight: 600, marginTop: '4px'
                                                }}>
                                                    <AlertCircle size={16} /> Evidence upload locked for current status
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ flex: 0.8, background: '#f8fafc', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Users size={18} /> RESEARCH TEAM
                                </div>

                                {isEditMode && (
                                    <div style={{ position: 'relative' }}>
                                        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            placeholder="Find members..."
                                            value={memberSearchTerm}
                                            onChange={(e) => setMemberSearchTerm(e.target.value)}
                                            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: 'white' }}
                                        />
                                    </div>
                                )}

                                <div style={{
                                    flex: 1, overflowY: 'auto', background: 'white', borderRadius: '20px',
                                    border: '1px solid #e2e8f0', padding: '8px'
                                }}>
                                    {isEditMode ? (
                                        // EDIT MODE: Show all project members to allow assignment
                                        filteredMembers.length === 0 ? (
                                            <p style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.85rem' }}>No project members found.</p>
                                        ) : (
                                            filteredMembers.map((m) => {
                                                // For ProjectMember, m.memberId or m.id is the membershipId
                                                const mId = m.memberId || m.id || m.userId || '';
                                                const isAssignee = memberId === mId;
                                                const isCollaborator = supportMemberIds.includes(mId);

                                                return (
                                                    <div key={mId} style={{
                                                        display: 'flex', alignItems: 'center', padding: '12px', borderRadius: '14px',
                                                        marginBottom: '6px', background: isAssignee ? '#eff6ff' : isCollaborator ? '#f0fdf4' : 'transparent',
                                                        border: isAssignee ? '1px solid #dbeafe' : isCollaborator ? '1px solid #dcfce7' : '1px solid transparent'
                                                    }}>
                                                        <div style={{ marginRight: '12px' }}>
                                                            {(m as any).avatar || (m as any).avatarUrl ? (
                                                                <img
                                                                    src={(m as any).avatar || (m as any).avatarUrl}
                                                                    alt={m.fullName || m.userName}
                                                                    style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                                                                />
                                                            ) : (
                                                                <div style={{
                                                                    width: '38px', height: '38px', borderRadius: '50%',
                                                                    background: isAssignee ? 'var(--primary-color)' : isCollaborator ? '#10b981' : '#cbd5e1',
                                                                    color: 'white',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '0.85rem', fontWeight: 800
                                                                }}>
                                                                    {(m.fullName || m.userName || '?')[0].toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{m.fullName || m.userName}</p>
                                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>{m.projectRoleName || m.roleName || 'Researcher'}</p>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newId = isAssignee ? '' : mId;
                                                                    setMemberId(newId);
                                                                    // Rule 2: If selected as primary, remove from collaborators
                                                                    if (newId && supportMemberIds.includes(newId)) {
                                                                        setSupportMemberIds(prev => prev.filter(id => id !== newId));
                                                                    }
                                                                }}
                                                                // Rule 1: No Lab Directors allowed as assignee
                                                                disabled={
                                                                    (m.projectRole === ProjectRoleEnum.LabDirector ||
                                                                        m.projectRoleName === 'Lab Director' ||
                                                                        m.roleName === 'Lab Director') && !isAssignee
                                                                }
                                                                style={{
                                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800,
                                                                    border: '1.5px solid', borderColor: isAssignee ? 'var(--primary-color)' : '#e2e8f0',
                                                                    background: isAssignee ? 'var(--primary-color)' : 'white',
                                                                    color: isAssignee ? 'white' : '#64748b', cursor: (m.projectRole === ProjectRoleEnum.LabDirector ||
                                                                        m.projectRoleName === 'Lab Director' ||
                                                                        m.roleName === 'Lab Director') && !isAssignee ? 'not-allowed' : 'pointer',
                                                                    opacity: (m.projectRole === ProjectRoleEnum.LabDirector ||
                                                                        m.projectRoleName === 'Lab Director' ||
                                                                        m.roleName === 'Lab Director') && !isAssignee ? 0.5 : 1
                                                                }}
                                                            >Assign</button>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleSupportMember(mId)}
                                                                // Rule 1: No Lab Directors allowed as collaborator
                                                                // Rule 2: Cannot be collaborator if already primary assignee
                                                                disabled={
                                                                    ((m.projectRole === ProjectRoleEnum.LabDirector ||
                                                                        m.projectRoleName === 'Lab Director' ||
                                                                        m.roleName === 'Lab Director') && !isCollaborator) ||
                                                                    (isAssignee)
                                                                }
                                                                style={{
                                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800,
                                                                    border: '1.5px solid', borderColor: isCollaborator ? '#10b981' : '#e2e8f0',
                                                                    background: isCollaborator ? '#10b981' : 'white',
                                                                    color: isCollaborator ? 'white' : '#64748b',
                                                                    cursor: (((m.projectRole === ProjectRoleEnum.LabDirector ||
                                                                        m.projectRoleName === 'Lab Director' ||
                                                                        m.roleName === 'Lab Director') && !isCollaborator) || isAssignee) ? 'not-allowed' : 'pointer',
                                                                    opacity: (((m.projectRole === ProjectRoleEnum.LabDirector ||
                                                                        m.projectRoleName === 'Lab Director' ||
                                                                        m.roleName === 'Lab Director') && !isCollaborator) || isAssignee) ? 0.5 : 1
                                                                }}
                                                            >Collab</button>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )
                                    ) : (
                                        // VIEW MODE: Show members currently assigned to this activity
                                        (!task?.memberId && (!task?.members || task.members.length === 0)) ? (
                                            <p style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.85rem' }}>No members assigned to this activity.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {/* Primary Assignee Display */}
                                                {task.memberId && (
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', padding: '12px', borderRadius: '14px',
                                                        background: '#eff6ff', border: '1px solid #dbeafe'
                                                    }}>
                                                        <div style={{ marginRight: '12px' }}>
                                                            {task.member?.avatarUrl || task.member?.avatar ? (
                                                                <img
                                                                    src={task.member?.avatarUrl || task.member?.avatar}
                                                                    alt={task.member?.fullName || 'Primary'}
                                                                    style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                                                                />
                                                            ) : (
                                                                <div style={{
                                                                    width: '38px', height: '38px', borderRadius: '50%',
                                                                    background: 'var(--primary-color)', color: 'white',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '0.85rem', fontWeight: 800
                                                                }}>
                                                                    {(task.member?.fullName || task.member?.userName || 'P')[0].toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>
                                                                {task.member?.fullName || task.member?.userName || 'Primary Researcher'}
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                                                                {task.member?.projectRoleName || task.member?.roleName || 'Primary Assignee'}
                                                            </p>
                                                        </div>
                                                        <div style={{
                                                            padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800,
                                                            background: 'var(--primary-color)', color: 'white'
                                                        }}>
                                                            Primary
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Support Members Display */}
                                                {(task.members || [])
                                                    .filter(m => {
                                                        const mId = m.memberId || m.userId || m.id;
                                                        return mId !== task.memberId;
                                                    })
                                                    .map((m: any) => {
                                                        const mId = m.memberId || m.userId || m.id;

                                                        // CRITICAL: Enrich collaborator data with full project member info if available
                                                        // This ensures we get the real projectRoleName (e.g. "Designer") instead of generic "Member"
                                                        const pm = (projectMembers || []).find(p => (p.memberId || p.id || p.userId) === mId);
                                                        const displayName = pm?.fullName || pm?.userName || m.fullName || m.userName;
                                                        const displayRole = pm?.projectRoleName || pm?.roleName || m.projectRoleName || m.roleName || 'Collaborator';
                                                        const displayAvatar = pm?.avatarUrl || pm?.avatar || m.avatar || m.avatarUrl;

                                                        return (
                                                            <div key={m.id || mId} style={{
                                                                display: 'flex', alignItems: 'center', padding: '12px', borderRadius: '14px',
                                                                background: '#f8fafc', border: '1px solid #f1f5f9'
                                                            }}>
                                                                <div style={{ marginRight: '12px' }}>
                                                                    {displayAvatar ? (
                                                                        <img
                                                                            src={displayAvatar}
                                                                            alt={displayName}
                                                                            style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                                                                        />
                                                                    ) : (
                                                                        <div style={{
                                                                            width: '38px', height: '38px', borderRadius: '50%',
                                                                            background: '#10b981', color: 'white',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            fontSize: '0.85rem', fontWeight: 800
                                                                        }}>
                                                                            {(displayName || 'U')[0].toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                                                        {displayName}
                                                                    </p>
                                                                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                                                                        {displayRole}
                                                                    </p>
                                                                </div>
                                                                <div style={{
                                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800,
                                                                    background: '#10b981', color: 'white'
                                                                }}>
                                                                    Support
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                {!task.memberId && (!task.members || task.members.length === 0) && (
                                                    <p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                        No members assigned to this task.
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>


                            </div>
                        </>
                    )}
                </form>

                {/* Footer */}
                <div style={{
                    padding: '1.25rem 2rem', borderTop: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'flex-end', gap: '14px', background: 'white',
                    alignItems: 'center'
                }}>
                    {isAuthorizedToEdit && task?.status === TaskStatus.Todo && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            style={{
                                padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid #fee2e2',
                                background: '#fef2f2', color: '#ef4444', fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                marginRight: 'auto'
                            }}
                        >
                            <Trash2 size={16} /> Delete Activity
                        </button>
                    )}
                    {isAuthorizedToEdit && !isEditMode && nextStatuses.length > 0 && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {nextStatuses.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => handleStatusTransition(s)}
                                    style={{
                                        padding: '0.75rem 2rem',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: s === TaskStatus.Completed ? '#16a34a' : '#ea580c',
                                        color: 'white',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        transition: 'all 0.2s',
                                        boxShadow: s === TaskStatus.Completed
                                            ? '0 4px 12px rgba(22, 163, 74, 0.2)'
                                            : '0 4px 12px rgba(234, 88, 12, 0.2)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = s === TaskStatus.Completed
                                            ? '0 6px 16px rgba(22, 163, 74, 0.3)'
                                            : '0 6px 16px rgba(234, 88, 12, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = s === TaskStatus.Completed
                                            ? '0 4px 12px rgba(22, 163, 74, 0.2)'
                                            : '0 4px 12px rgba(234, 88, 12, 0.2)';
                                    }}
                                >
                                    <Activity size={18} />
                                    {getStatusActionLabel(s)}
                                </button>
                            ))}
                        </div>
                    )}
                    {(isEditMode || (!error && evidenceFiles.length > 0)) && (
                        <button type="submit" onClick={handleSave} className="btn btn-primary" style={{ padding: '0.75rem 3rem', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isEditMode ? <Save size={18} /> : null}
                            {isEditMode ? 'Save Changes' : 'Upload Evidence'}
                        </button>
                    )}
                </div>

                {/* Notifications & Confirmation Modal */}
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}

                <ConfirmModal
                    isOpen={confirmConfig.isOpen}
                    title={confirmConfig.title}
                    message={confirmConfig.message}
                    variant={confirmConfig.variant}
                    confirmText={confirmConfig.confirmText}
                    onConfirm={confirmConfig.onConfirm}
                    onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                />
            </div>
        </div>
    );
};

export default TaskDetailModal;
