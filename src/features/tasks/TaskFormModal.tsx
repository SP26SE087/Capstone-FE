import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Users, Calendar, CheckSquare, AlignLeft, AlertTriangle, MapPin, AlertOctagon, Plus, Trash2, FileText, File, Eye, Clock } from 'lucide-react';
import { Priority, TaskStatus, ProjectMember, Task, TaskEvidence, ProjectRoleEnum } from '@/types';
import MilestoneRoadmapPreview from '../milestones/MilestoneRoadmapPreview';

interface TaskFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (taskData: any) => void;
    projectMembers?: ProjectMember[];
    initialStatus?: TaskStatus;
    task?: Task | null;
    isReadOnly?: boolean;
    onEvidenceUpload?: (files: File[]) => void;
    milestones?: Milestone[];
    initialMilestoneId?: string;
    projectStartDate?: string;
    projectEndDate?: string;
    existingTasks?: Task[];
    projectId?: string;
    submitting?: boolean;
}


const SearchableSelect: React.FC<{
    options: { id: string; name: string; info?: string }[];
    value: string | string[];
    onChange: (id: string | string[]) => void;
    placeholder: string;
    icon?: React.ReactNode;
    multiple?: boolean;
}> = ({ options, value, onChange, placeholder, icon, multiple }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const valueArray = Array.isArray(value) ? value : [value];
    const selectedOptions = options.filter(o => valueArray.includes(o.id));

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const term = searchTerm.toLowerCase();
        return options.filter(o => o.name.toLowerCase().includes(term) || (o.info && o.info.toLowerCase().includes(term)));
    }, [options, searchTerm]);

    // Handle clicks outside to close
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = () => setIsOpen(false);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [isOpen]);

    return (
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    minHeight: '42px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {icon && <span style={{ color: '#94a3b8', display: 'flex' }}>{icon}</span>}
                    <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: selectedOptions.length > 0 ? '#1e293b' : '#94a3b8',
                        fontWeight: selectedOptions.length > 0 ? 600 : 400
                    }}>
                        {selectedOptions.length > 0
                            ? (multiple ? `${selectedOptions.length} Collaborators` : selectedOptions[0].name)
                            : placeholder}
                    </span>
                </div>
                {multiple ? <Plus size={14} style={{ color: '#94a3b8', flexShrink: 0 }} /> : <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />}
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1.5px solid #f1f5f9',
                                fontSize: '0.8rem',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>No results match.</div>
                        ) : (
                            filteredOptions.map(opt => {
                                const isSelected = valueArray.includes(opt.id);
                                return (
                                    <div
                                        key={opt.id}
                                        onClick={() => {
                                            if (multiple) {
                                                const newValue = isSelected
                                                    ? valueArray.filter(v => v !== opt.id)
                                                    : [...valueArray, opt.id].filter(v => v !== '');
                                                onChange(newValue);
                                            } else {
                                                onChange(opt.id);
                                                setIsOpen(false);
                                                setSearchTerm('');
                                            }
                                        }}
                                        style={{
                                            padding: '10px 12px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            background: isSelected ? '#f0f7ff' : 'transparent',
                                            borderLeft: isSelected ? '3px solid var(--primary-color)' : '3px solid transparent',
                                            transition: 'all 0.15s',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.background = isSelected ? '#f0f7ff' : 'transparent'}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{opt.name}</div>
                                            {opt.info && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{opt.info}</div>}
                                        </div>
                                        {multiple && isSelected && <span style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 800 }}>Selected</span>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


import { Milestone, MilestoneStatus } from '@/types/milestone';
import { milestoneService, membershipService, taskService } from '@/services';
import { API_BASE_URL } from '@/services/api';

interface TaskRow {
    id: string; // Internal temporary ID for React keys
    name: string;
    description: string;
    priority: Priority;
    status: TaskStatus;
    milestoneId: string;
    memberId: string;
    supportMemberIds: string[];
    startDate: string;
    dueDate: string;
}

const TaskFormModal: React.FC<TaskFormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    projectMembers,
    initialStatus = TaskStatus.Todo,
    task = null,
    isReadOnly = false,
    onEvidenceUpload,
    milestones,
    initialMilestoneId,
    projectStartDate,
    projectEndDate,
    existingTasks = [],
    projectId,
    submitting = false
}) => {
    // Standard single-task states (used for editing existing task)
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<Priority>(Priority.Medium);
    const [status, setStatus] = useState<TaskStatus>(initialStatus);
    const [milestoneId, setMilestoneId] = useState<string>('');
    const [memberId, setMemberId] = useState<string>('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [supportMemberIds, setSupportMemberIds] = useState<string[]>([]);
    const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
    const [serverEvidences, setServerEvidences] = useState<TaskEvidence[]>([]);

    // Bulk creation states
    const [rows, setRows] = useState<TaskRow[]>([]);
    const [isBulkMode, setIsBulkMode] = useState(true);

    const createNewRow = (): TaskRow => ({
        id: Math.random().toString(36).substring(2, 9),
        name: '',
        description: '',
        priority: Priority.Medium,
        status: initialStatus,
        milestoneId: initialMilestoneId || '',
        memberId: '',
        supportMemberIds: [],
        startDate: '',
        dueDate: ''
    });

    const addRow = () => setRows([...rows, createNewRow()]);
    const removeRow = (id: string) => {
        if (rows.length > 1) {
            setRows(rows.filter(r => r.id !== id));
        }
    };
    const updateRow = (id: string, field: keyof TaskRow, value: any) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    // UI State for custom warning
    const [showAssigneeWarning, setShowAssigneeWarning] = useState(false);

    // Search states for members
    const [memberSearchTerm, setMemberSearchTerm] = useState('');

    // Milestone search and filter states
    const [milestoneSearchTerm, setMilestoneSearchTerm] = useState('');
    const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<string>('all');

    const [internalTasks, setInternalTasks] = useState<Task[]>([]);

    useEffect(() => {
        // Fetch project tasks if not provided
        if (isOpen && (!existingTasks || existingTasks.length === 0)) {
            const effectiveProjId = projectId || (milestones?.[0] as any)?.projectId || (milestones?.[0] as any)?.project_id;
            if (effectiveProjId) {
                taskService.getByProject(effectiveProjId).then(setInternalTasks).catch(() => {});
            }
        }
    }, [isOpen, existingTasks, projectId, milestones]);

    const effectiveExistingTasks = (existingTasks && existingTasks.length > 0) ? existingTasks : internalTasks;

    // Internal data states for when props aren't provided
    const [internalMembers, setInternalMembers] = useState<ProjectMember[]>([]);
    const [internalMilestones, setInternalMilestones] = useState<Milestone[]>([]);
    const [fetchedMilestone, setFetchedMilestone] = useState<Milestone | null>(null);

    // Determine which data to use (prop vs internal)
    const effectiveMembers = projectMembers || internalMembers;
    const baseMilestones = milestones || internalMilestones;
    const effectiveMilestones = useMemo(() => {
        let list = baseMilestones;
        
        // If not editing an existing task, filter for active milestones only
        // If editing, allow the current milestone even if completed
        if (!task) {
            list = list.filter(m => m.status === MilestoneStatus.NotStarted || m.status === MilestoneStatus.InProgress);
        } else {
            const currentMid = (task as any).milestoneId || (task as any).milestoneID || (task as any).milestone?.id || '';
            list = list.filter(m => 
                m.status === MilestoneStatus.NotStarted || 
                m.status === MilestoneStatus.InProgress ||
                String(m.milestoneId || (m as any).id) === String(currentMid)
            );
        }

        if (fetchedMilestone && !list.some(m => String(m.milestoneId || (m as any).id).toLowerCase() === String(fetchedMilestone.milestoneId || (fetchedMilestone as any).id).toLowerCase())) {
            return [fetchedMilestone, ...list];
        }
        return list;
    }, [baseMilestones, fetchedMilestone, task]);

    const selectableMembers = useMemo(() => {
        return effectiveMembers.filter(m => 
            m.projectRole !== ProjectRoleEnum.LabDirector && 
            m.projectRoleName !== 'Lab Director' && 
            m.roleName !== 'Lab Director'
        );
    }, [effectiveMembers]);

    const resetForm = () => {
        setName('');
        setDescription('');
        setMemberId('');
        setSupportMemberIds([]);
        setMemberSearchTerm('');
        setStartDate('');
        setDueDate('');
        setStatus(initialStatus);
        setPriority(Priority.Medium);
        setMilestoneId(initialMilestoneId || '');
        setShowAssigneeWarning(false);
        setEvidenceFiles([]);
        setServerEvidences([]);
        // Reset rows for creation mode
        setRows([createNewRow()]);
        setIsBulkMode(true);
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

    const handleDeleteEvidence = async (evidenceId: number) => {
        if (!task?.taskId) return;
        if (window.confirm("Are you sure you want to remove this evidence?")) {
            try {
                await taskService.deleteEvidence(task.taskId, evidenceId);
                setServerEvidences(prev => prev.filter(e => e.id !== evidenceId));
            } catch (err) {
                console.error("Failed to delete evidence:", err);
                alert("Failed to remove evidence. Please check if the file still exists on server.");
            }
        }
    };

    const executeSubmit = () => {
        if (isBulkMode && !task) {
            // Bulk Create Mode
            const today = new Date().toISOString().split('T')[0];
            
            // Validate all rows first
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row.name) {
                    alert(`Task #${i + 1} must have a name.`);
                    return;
                }

                if (row.milestoneId) {
                    const milestone = effectiveMilestones.find(m => String(m.milestoneId || (m as any).id) === String(row.milestoneId));
                    if (milestone && milestone.startDate && milestone.dueDate) {
                        const mStart = new Date(milestone.startDate).getTime();
                        const mEnd = new Date(milestone.dueDate).getTime();
                        const tStart = new Date(row.startDate || today).getTime();
                        const tEnd = row.dueDate ? new Date(row.dueDate).getTime() : tStart;

                        if (tStart < mStart || tEnd > mEnd) {
                            alert(`Task #${i + 1} ("${row.name}") dates must be within milestone period: ${formatDate(milestone.startDate)} - ${formatDate(milestone.dueDate)}`);
                            return;
                        }
                    }
                }
            }

            const tasksData = rows.map(row => ({
                name: row.name,
                description: row.description,
                priority: row.priority,
                status: row.status,
                milestoneId: row.milestoneId || null,
                memberId: row.memberId || null,
                startDate: new Date(row.startDate || today).toISOString(),
                dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
                supportMembers: row.supportMemberIds || [],
                evidence: []
            }));

            onSubmit(tasksData);
            resetForm();
            onClose();
            return;
        }

        // Single Edit/Create Mode
        const todayAtZero = new Date().toISOString().split('T')[0];

        // Validation for single mode
        if (milestoneId) {
            const milestone = effectiveMilestones.find(m => String(m.milestoneId || (m as any).id) === String(milestoneId));
            if (milestone && milestone.startDate && milestone.dueDate) {
                const mStart = new Date(milestone.startDate).getTime();
                const mEnd = new Date(milestone.dueDate).getTime();
                const tStart = new Date(startDate || todayAtZero).getTime();
                const tEnd = dueDate ? new Date(dueDate).getTime() : tStart;

                if (tStart < mStart || tEnd > mEnd) {
                    alert(`Task dates must be within milestone period: ${formatDate(milestone.startDate)} - ${formatDate(milestone.dueDate)}`);
                    return;
                }
            }
        }

        const taskData = {
            name,
            description,
            priority,
            status,
            milestoneId: milestoneId || null,
            memberId: memberId || null,
            startDate: new Date(startDate || todayAtZero).toISOString(),
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            supportMembers: supportMemberIds,
            evidence: evidenceFiles
        };

        if (isReadOnly && onEvidenceUpload && evidenceFiles.length > 0) {
            onEvidenceUpload(evidenceFiles);
            setEvidenceFiles([]);
            return;
        }

        onSubmit(taskData);
        onClose();
    };


    const toggleSupportMember = (id: string) => {
        // Rule 2: A member cannot be both assignee and collaborator
        if (id === memberId) return;

        if (supportMemberIds.includes(id)) {
            setSupportMemberIds(supportMemberIds.filter(mId => mId !== id));
        } else {
            setSupportMemberIds([...supportMemberIds, id]);
        }
    };

    useEffect(() => {
        if (task && isOpen) {
            setIsBulkMode(false);
            setName(task.name || '');
            setDescription(task.description || '');
            setPriority(task.priority);
            setStatus(task.status);
            setMemberId(task.memberId || '');
            setStartDate(task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
            setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
            const mid = (task as any).milestoneId || (task as any).milestoneID || (task as any).milestone_id || (task as any).milestone?.id || '';
            setMilestoneId(mid);


            // Proactively fetch details for the specific milestone
            if (mid) {
                milestoneService.getById(mid).then(setFetchedMilestone).catch(() => {});
            } else {
                setFetchedMilestone(null);
            }
            // Use membershipId/memberId which is the persistent ID, NOT the TaskMember association id
            setSupportMemberIds(task.members?.map((m: any) => m.membershipId || m.memberId) || []);

            // If we don't have members or milestones, fetch them for this task's project
            if (task.projectId) {
                if (!projectMembers) {
                    membershipService.getProjectMembers(task.projectId).then(setInternalMembers);
                }
                if (!milestones) {
                    milestoneService.getByProject(task.projectId).then(setInternalMilestones);
                }

                // Fetch evidences
                taskService.getEvidences(task.taskId).then(setServerEvidences);
            }
        } else if (!isOpen) {
            resetForm();
        }
    }, [task, isOpen, initialStatus, projectMembers, milestones]);

    const filteredMembers = useMemo(() => {
        // Rule 1: Filter out Lab Directors unless they are already assigned to this task
        const list = effectiveMembers.filter(m => {
            const mId = m.memberId || m.id || '';
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
        return new Date(dateStr).toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' });
    };

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // If no assignee and warning not shown yet (only for NEW tasks)
        if (!task && !memberId && !showAssigneeWarning) {
            setShowAssigneeWarning(true);
            return;
        }

        executeSubmit();
    };



    const isEdit = !!task;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setEvidenceFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
        }}>
            <div style={{
                background: 'white',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '1000px',
                maxHeight: '90vh',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Custom Assignee Warning Overlay */}
                {showAssigneeWarning && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <div style={{
                            background: 'white',
                            padding: '2.5rem',
                            borderRadius: '20px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            maxWidth: '450px',
                            width: '100%',
                            textAlign: 'center',
                            border: '1px solid #fee2e2'
                        }}>
                            <div style={{
                                width: '64px', height: '64px', background: '#fef2f2',
                                borderRadius: '50%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', margin: '0 auto 1.5rem', color: '#ef4444'
                            }}>
                                <AlertTriangle size={32} />
                            </div>
                            <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
                                Unassigned Task
                            </h3>
                            <p style={{ margin: '0 0 2rem', fontSize: '0.95rem', color: '#64748b', lineHeight: 1.6 }}>
                                This activity currently has no <strong>Primary Assignee</strong> assigned. Would you like to proceed and create it anyway?
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setShowAssigneeWarning(false)}
                                    style={{
                                        padding: '0.8rem 1.5rem', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                        background: 'white', color: '#64748b', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeSubmit}
                                    style={{
                                        padding: '0.8rem 2rem', borderRadius: '12px', border: 'none',
                                        background: 'var(--primary-color)', color: 'white', fontWeight: 700,
                                        cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                                    }}
                                >
                                    Yes, Create Task
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div style={{
                    padding: '1.25rem 2rem',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#fff',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                padding: '10px',
                                background: 'var(--primary-color)',
                                borderRadius: '12px',
                                color: 'white',
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                            }}>
                                <CheckSquare size={20} />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
                                {isReadOnly ? 'Research Task Details' : (isEdit ? 'Update Task' : 'Register Research Tasks')}
                            </h2>
                            {!isEdit && !isReadOnly && (
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                    You can register multiple research activities at once
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{ border: 'none', background: '#f8fafc', cursor: 'pointer', color: '#64748b', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Roadmap Preview First */}
                {!isReadOnly && (() => {
                    const activeMid = milestoneId || (rows.length > 0 ? rows[0].milestoneId : initialMilestoneId) || "";
                    const currentMilestoneContext = effectiveMilestones.find(m => String(m.milestoneId || (m as any).id || (m as any).ID || '').toLowerCase() === String(activeMid).toLowerCase());
                    const roadmapStart = currentMilestoneContext?.startDate || projectStartDate;
                    const roadmapEnd = currentMilestoneContext?.dueDate || projectEndDate;

                    return (
                        <MilestoneRoadmapPreview 
                            existingMilestones={effectiveExistingTasks.filter(t => {
                                if (!activeMid) return false;
                                 const tMid = (t as any).milestoneId || (t as any).milestoneID || (t as any).milestone_id || (t as any).milestone?.id || '';
                                return String(tMid).toLowerCase() === String(activeMid).toLowerCase() && (!task || t.taskId !== task.taskId);
                            }).map(t => ({
                                id: t.taskId,
                                name: t.name,
                                startDate: t.startDate || "",
                                dueDate: t.dueDate || "",
                                description: t.description || "",
                                status: Number(t.status)
                            }))}
                            currentMilestones={isBulkMode && !task ? rows.filter(r => r.name && r.startDate && r.dueDate).map(r => ({
                                id: r.id,
                                name: r.name,
                                startDate: r.startDate || "",
                                dueDate: r.dueDate || ""
                            })) : (name && startDate && dueDate ? [{
                                id: task?.taskId || 'new',
                                name: name,
                                startDate: startDate,
                                dueDate: dueDate
                            }] : [])}
                            projectStartDate={roadmapStart}
                            projectEndDate={roadmapEnd}
                            highlightId={task?.taskId}
                        />
                    );
                })()}

                {/* Body - Form Layout */}
                <form id="create-task-form" onSubmit={handleSubmit} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {isBulkMode && !task ? (
                        /* Bulk Activities View */
                        <div style={{
                            flex: 1,
                            padding: '2rem',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.5rem',
                            background: '#f8fafc'
                        }}>
                            {rows.map((row, index) => (
                                <div key={row.id} style={{
                                    padding: '1.5rem',
                                    background: 'white',
                                    borderRadius: '16px',
                                    border: '1.5px solid #e2e8f0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1.25rem',
                                    position: 'relative',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                                                {index + 1}
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Task #{index + 1}</span>
                                        </div>
                                        {rows.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRow(row.id)}
                                                style={{ border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <Trash2 size={14} /> Remove
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1.25rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Task Name *</label>
                                            <input
                                                required
                                                type="text"
                                                placeholder="What needs to be done?"
                                                value={row.name}
                                                onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                                                style={{ padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Priority</label>
                                            <select
                                                value={row.priority}
                                                onChange={(e) => updateRow(row.id, 'priority', Number(e.target.value))}
                                                style={{ padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 600, fontSize: '0.85rem' }}
                                            >
                                                <option value={Priority.Low}>Low</option>
                                                <option value={Priority.Medium}>Medium</option>
                                                <option value={Priority.High}>High</option>
                                                <option value={Priority.Critical}>Critical</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Status</label>
                                            <select
                                                value={row.status}
                                                onChange={(e) => updateRow(row.id, 'status', Number(e.target.value))}
                                                style={{ padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 600, fontSize: '0.85rem' }}
                                            >
                                                <option value={TaskStatus.Todo}>To Do</option>
                                                <option value={TaskStatus.InProgress}>In Progress</option>
                                                <option value={TaskStatus.Submitted}>Submitted</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Row 2: Team Selection */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Primary Assignee</label>
                                            <SearchableSelect
                                                placeholder="Assign to..."
                                                options={[
                                                    { id: '', name: 'Unassigned', info: 'Clear assignee' },
                                                    ...selectableMembers.map(m => ({
                                                        id: (m.memberId || m.id || '').toString(),
                                                        name: m.fullName || m.userName || 'Unknown Member',
                                                        info: m.projectRoleName || m.roleName || ''
                                                    }))
                                                ]}
                                                value={row.memberId}
                                                onChange={(val) => {
                                                    const newMemberId = val as string;
                                                    updateRow(row.id, 'memberId', newMemberId);
                                                    // Rule 2: Remove from collaborators if chosen as assignee
                                                    if (newMemberId && row.supportMemberIds.includes(newMemberId)) {
                                                        updateRow(row.id, 'supportMemberIds', row.supportMemberIds.filter(id => id !== newMemberId));
                                                    }
                                                }}
                                                icon={<Users size={16} />}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Collaborators</label>
                                            <SearchableSelect
                                                multiple
                                                placeholder="Add collaborators..."
                                                options={selectableMembers.map(m => ({
                                                    id: (m.memberId || m.id || '').toString(),
                                                    name: m.fullName || m.userName || 'Unknown Member',
                                                    info: m.projectRoleName || m.roleName || ''
                                                }))}
                                                value={row.supportMemberIds}
                                                onChange={(val) => {
                                                    const newSupportIds = val as string[];
                                                    // Rule 2: A member cannot be both assignee and collaborator
                                                    const filteredSupportIds = row.memberId 
                                                        ? newSupportIds.filter(id => id !== row.memberId)
                                                        : newSupportIds;
                                                    updateRow(row.id, 'supportMemberIds', filteredSupportIds);
                                                }}
                                                icon={<Users size={16} />}
                                            />
                                        </div>
                                    </div>

                                    {/* Row 3: Milestone & Dates */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Milestone</label>
                                            <SearchableSelect
                                                placeholder="Link milestone..."
                                                options={[
                                                    { id: '', name: 'No Milestone', info: 'Clear milestone' },
                                                    ...effectiveMilestones.map(m => ({
                                                        id: (m.milestoneId || (m as any).id || '').toString(),
                                                        name: m.name || 'Unnamed Milestone',
                                                        info: m.startDate ? `${formatDate(m.startDate)} - ${formatDate(m.dueDate)}` : 'No dates'
                                                    }))
                                                ]}
                                                value={row.milestoneId}
                                                onChange={(val) => updateRow(row.id, 'milestoneId', val as string)}
                                                icon={<MapPin size={16} />}
                                            />
                                        </div>
                                            {(() => {
                                                const milestone = effectiveMilestones.find(m => String(m.milestoneId || (m as any).id) === String(row.milestoneId));
                                                const mStart = milestone?.startDate ? new Date(milestone.startDate).getTime() : null;
                                                const mEnd = milestone?.dueDate ? new Date(milestone.dueDate).getTime() : null; 
                                                
                                                const getTime = (d: string) => d ? new Date(d).getTime() : null;
                                                const tStart = getTime(row.startDate);
                                                const tEnd = getTime(row.dueDate);
                                                const msStart = mStart;
                                                const msEnd = mEnd; // Use mEnd here since we just calculated it at msEnd level

                                                const isStartInvalid = msStart && tStart && tStart < msStart || msEnd && tStart && tStart > msEnd;
                                                const isDueInvalid = msStart && tEnd && tEnd < msStart || msEnd && tEnd && tEnd > msEnd;

                                                return (
                                                    <div style={{ flex: 1, display: 'flex', gap: '12px', minWidth: 0 }}>
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: isStartInvalid ? '#ef4444' : '#94a3b8', textTransform: 'uppercase' }}>
                                                                Start {isStartInvalid && '(!) '}
                                                            </label>
                                                            <input
                                                                type="date"
                                                                value={row.startDate}
                                                                min={milestone?.startDate ? new Date(milestone.startDate).toISOString().split('T')[0] : undefined}
                                                                max={milestone?.dueDate ? new Date(milestone.dueDate).toISOString().split('T')[0] : undefined}
                                                                onChange={(e) => updateRow(row.id, 'startDate', e.target.value)}
                                                                style={{ 
                                                                    padding: '0.65rem', borderRadius: '10px', 
                                                                    border: isStartInvalid ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0', 
                                                                    fontSize: '0.8rem', width: '100%',
                                                                    background: isStartInvalid ? '#fff1f2' : 'white'
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: isDueInvalid ? '#ef4444' : '#94a3b8', textTransform: 'uppercase' }}>
                                                                Due {isDueInvalid && '(!) '}
                                                            </label>
                                                            <input
                                                                type="date"
                                                                value={row.dueDate}
                                                                min={row.startDate || (milestone?.startDate ? new Date(milestone.startDate).toISOString().split('T')[0] : undefined)}
                                                                max={milestone?.dueDate ? new Date(milestone.dueDate).toISOString().split('T')[0] : undefined}
                                                                onChange={(e) => updateRow(row.id, 'dueDate', e.target.value)}
                                                                style={{ 
                                                                    padding: '0.65rem', borderRadius: '10px', 
                                                                    border: isDueInvalid ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0', 
                                                                    fontSize: '0.8rem', width: '100%',
                                                                    background: isDueInvalid ? '#fff1f2' : 'white'
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                    </div>


                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Description</label>
                                        <textarea
                                            placeholder="Task details..."
                                            value={row.description}
                                            onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                                            style={{ padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', minHeight: '60px', resize: 'none' }}
                                        />
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={addRow}
                                style={{
                                    padding: '1rem',
                                    borderRadius: '16px',
                                    border: '2px dashed #cbd5e1',
                                    background: 'white',
                                    color: 'var(--primary-color)',
                                    fontWeight: 800,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-color)'; e.currentTarget.style.background = '#f0f7ff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = 'white'; }}
                            >
                                <Plus size={20} /> Add Another Research Task
                            </button>
                        </div>
                    ) : (
                        /* Standard Activity View (Existing logic) */
                        <>
                            {/* Left Column: Basic Info */}
                            <div style={{
                                flex: 1,

                        padding: '2rem',
                        overflowY: 'auto',
                        borderRight: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.75rem'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckSquare size={14} /> Task Name *
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="Enter activity title..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isReadOnly}
                                style={{
                                    padding: '0.85rem 1.15rem',
                                    borderRadius: '12px',
                                    border: '1.5px solid #e2e8f0',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    background: isReadOnly ? '#f8fafc' : 'white',
                                    color: isReadOnly ? '#334155' : 'inherit'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlignLeft size={14} /> Description
                            </label>
                            <textarea
                                rows={5}
                                placeholder="Describe the task goals and scope..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={isReadOnly}
                                style={{
                                    padding: '0.85rem 1.15rem',
                                    borderRadius: '12px',
                                    border: '1.5px solid #e2e8f0',
                                    fontSize: '0.95rem',
                                    resize: 'none',
                                    outline: 'none',
                                    lineHeight: 1.6,
                                    background: isReadOnly ? '#f8fafc' : 'white',
                                    color: isReadOnly ? '#334155' : 'inherit'
                                }}
                            />
                        </div>

                        {/* Evidence Upload Area - Sticky and Always visible in ReadOnly/Edit detail mode */}
                        {(isReadOnly || isEdit) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '1.25rem', background: '#f8fafc', borderRadius: '16px', border: '1.5px dashed #cbd5e1' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={18} color="var(--primary-color)" /> RESEARCH EVIDENCE & DOCUMENTATION
                                </label>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {/* Server Evidences */}
                                    {serverEvidences.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                            {serverEvidences.map((ev) => (
                                                <a
                                                    key={ev.id}
                                                    href={getFullUrl(ev.fileUrl || ev.url || '')}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px',
                                                        background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
                                                        cursor: 'pointer', transition: 'all 0.2s',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                                        textDecoration: 'none'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = 'var(--primary-color)';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <div style={{
                                                        padding: '8px', background: '#eff6ff', borderRadius: '8px', color: 'var(--primary-color)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <File size={18} />
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {ev.fileName || ev.name || 'Unnamed File'}
                                                        </p>
                                                        <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8' }}>
                                                            Uploaded {new Date(ev.submittedAt || ev.createdDate || Date.now()).toLocaleDateString('vi-VN')}
                                                        </p>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                window.open(getFullUrl(ev.fileUrl || ev.url || ''), '_blank');
                                                            }}
                                                            style={{ border: 'none', background: '#f8fafc', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                                                        ><Eye size={14} /></button>
                                                        {!isReadOnly && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleDeleteEvidence(ev.id);
                                                                }}
                                                                style={{ border: 'none', background: '#fff1f2', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                                                            ><Trash2 size={14} /></button>
                                                        )}
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    {/* New Local Files */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                                        {evidenceFiles.map((file, i) => (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px',
                                                background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px',
                                                fontSize: '0.75rem', fontWeight: 600, color: '#475569'
                                            }}>
                                                <FileText size={16} color="#94a3b8" />
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                                <button type="button" onClick={() => removeFile(i)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}

                                        {!isReadOnly && (
                                            <label style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                padding: '10px', background: 'white', color: 'var(--primary-color)',
                                                borderRadius: '12px', border: '2px dashed #e2e8f0',
                                                fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                                                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                            >
                                                <Plus size={16} /> Add Task Evidence
                                                <input type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>Upload PDFs, Images, or Documents as evidence for this task.</p>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertOctagon size={14} /> Priority
                                </label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(Number(e.target.value))}
                                    disabled={isReadOnly}
                                    style={{ padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: isReadOnly ? '#f8fafc' : 'white', cursor: isReadOnly ? 'default' : 'pointer', fontWeight: 600 }}
                                >
                                    <option value={Priority.Low}>Low</option>
                                    <option value={Priority.Medium}>Medium</option>
                                    <option value={Priority.High}>High</option>
                                    <option value={Priority.Critical}>Critical</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(Number(e.target.value))}
                                    disabled={isReadOnly}
                                    style={{ padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: isReadOnly ? '#f8fafc' : 'white', cursor: isReadOnly ? 'default' : 'pointer', fontWeight: 600 }}
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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MapPin size={16} color="var(--primary-color)" /> SELECT MILESTONE
                            </label>

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
                                    style={{ padding: '0.6rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.8rem', color: '#475569', fontWeight: 600, outline: 'none', display: 'flex', alignItems: 'center' }}
                                >
                                    <option value="all">All Milestones</option>
                                    <option value={MilestoneStatus.NotStarted.toString()}>Not Started</option>
                                    <option value={MilestoneStatus.InProgress.toString()}>In Progress</option>
                                    <option value={MilestoneStatus.Completed.toString()}>Completed</option>
                                </select>
                            </div>

                            <select
                                value={milestoneId}
                                onChange={(e) => setMilestoneId(e.target.value)}
                                disabled={isReadOnly}
                                style={{ padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: isReadOnly ? '#f8fafc' : 'white', cursor: isReadOnly ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
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

                        {(() => {
                            const milestone = effectiveMilestones.find(m => String(m.milestoneId || (m as any).id) === String(milestoneId));
                            const minDate = milestone?.startDate ? new Date(milestone.startDate).toISOString().split('T')[0] : undefined;
                            const maxDate = milestone?.dueDate ? new Date(milestone.dueDate).toISOString().split('T')[0] : undefined;
                            
                            const msStart = minDate ? new Date(minDate).getTime() : null;
                            const msEnd = maxDate ? new Date(maxDate).getTime() : null;
                            const tStart = startDate ? new Date(startDate).getTime() : null;
                            const tEnd = dueDate ? new Date(dueDate).getTime() : null;

                            const isStartInvalid = msStart && tStart && tStart < msStart || msEnd && tStart && tStart > msEnd;
                            const isDueInvalid = msStart && tEnd && tEnd < msStart || msEnd && tEnd && tEnd > msEnd;

                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ 
                                            fontSize: '0.8rem', fontWeight: 700, 
                                            color: isStartInvalid ? '#ef4444' : '#64748b', 
                                            textTransform: 'uppercase', letterSpacing: '0.05em', 
                                            display: 'flex', alignItems: 'center', gap: '6px' 
                                        }}>
                                            <Calendar size={14} /> Start Date {isStartInvalid && ' (Out of Range)'}
                                        </label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            min={minDate}
                                            max={maxDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            disabled={isReadOnly}
                                            style={{ 
                                                padding: '0.85rem 1.15rem', borderRadius: '12px', 
                                                border: isStartInvalid ? '2px solid #ef4444' : '1.5px solid #e2e8f0', 
                                                fontSize: '0.95rem', outline: 'none', 
                                                background: isReadOnly ? '#f8fafc' : (isStartInvalid ? '#fff1f2' : 'white')
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ 
                                            fontSize: '0.8rem', fontWeight: 700, 
                                            color: isDueInvalid ? '#ef4444' : '#64748b', 
                                            textTransform: 'uppercase', letterSpacing: '0.05em', 
                                            display: 'flex', alignItems: 'center', gap: '6px' 
                                        }}>
                                            <Calendar size={14} /> Deadline {isDueInvalid && ' (Out of Range)'}
                                        </label>
                                        <input
                                            type="date"
                                            value={dueDate}
                                            min={startDate || minDate}
                                            max={maxDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            disabled={isReadOnly}
                                            style={{ 
                                                padding: '0.85rem 1.15rem', borderRadius: '12px', 
                                                border: isDueInvalid ? '2px solid #ef4444' : '1.5px solid #e2e8f0', 
                                                fontSize: '0.95rem', outline: 'none', 
                                                background: isReadOnly ? '#f8fafc' : (isDueInvalid ? '#fff1f2' : 'white')
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Right Column: Member Selection (TASK TEAM) */}
                    <div style={{
                        flex: 1,
                        background: '#f8fafc',
                        padding: '2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem',
                        overflow: 'hidden'
                    }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Users size={18} /> TASK TEAM
                        </div>

                        {/* Search Bar */}
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Search by name..."
                                value={memberSearchTerm}
                                onChange={(e) => setMemberSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: 'white' }}
                            />
                        </div>

                        {/* Member List */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            background: 'white',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            padding: '6px',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                            {filteredMembers.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.85rem' }}>No members found.</p>
                            ) : (
                                filteredMembers.map((m) => {
                                    const mId = m.userId || m.memberId || '';
                                    const isAssignee = memberId === mId;
                                    const isCollaborator = supportMemberIds.includes(mId);

                                    return (
                                        <div
                                            key={mId}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '10px 14px',
                                                borderRadius: '12px',
                                                marginBottom: '4px',
                                                background: isAssignee ? '#eff6ff' : 'transparent',
                                                border: isAssignee ? '1px solid #dbeafe' : '1px solid transparent',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ marginRight: '12px', flexShrink: 0 }}>
                                                {(m as any).avatar || (m as any).avatarUrl ? (
                                                    <img
                                                        src={(m as any).avatar || (m as any).avatarUrl}
                                                        alt={m.fullName || m.userName}
                                                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: '36px', height: '36px', borderRadius: '50%',
                                                        background: isAssignee ? 'var(--primary-color)' : '#94a3b8', color: 'white',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.8rem', fontWeight: 800,
                                                        boxShadow: isAssignee ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
                                                    }}>
                                                        {(m.fullName || m.userName || '?')[0].toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p
                                                    title={m.fullName || m.userName}
                                                    style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                >
                                                    {m.fullName || m.userName}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>{m.projectRoleName || m.roleName || 'Researcher'}</p>
                                            </div>

                                            {!isReadOnly && (
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
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800,
                                                            border: '1.5px solid',
                                                            borderColor: isAssignee ? 'var(--primary-color)' : '#e2e8f0',
                                                            background: isAssignee ? 'var(--primary-color)' : 'white',
                                                            color: isAssignee ? 'white' : '#64748b',
                                                            cursor: (m.projectRole === ProjectRoleEnum.LabDirector || 
                                                                    m.projectRoleName === 'Lab Director' || 
                                                                    m.roleName === 'Lab Director') && !isAssignee ? 'not-allowed' : 'pointer', 
                                                            transition: 'all 0.2s',
                                                            opacity: (m.projectRole === ProjectRoleEnum.LabDirector || 
                                                                    m.projectRoleName === 'Lab Director' || 
                                                                    m.roleName === 'Lab Director') && !isAssignee ? 0.5 : 1
                                                        }}
                                                    >
                                                        Assign
                                                    </button>
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
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800,
                                                            border: '1.5px solid',
                                                            borderColor: isCollaborator ? '#10b981' : '#e2e8f0',
                                                            background: isCollaborator ? '#10b981' : 'white',
                                                            color: isCollaborator ? 'white' : '#64748b',
                                                            cursor: (((m.projectRole === ProjectRoleEnum.LabDirector || 
                                                                    m.projectRoleName === 'Lab Director' || 
                                                                    m.roleName === 'Lab Director') && !isCollaborator) || isAssignee) ? 'not-allowed' : 'pointer',
                                                            transition: 'all 0.2s',
                                                            opacity: (((m.projectRole === ProjectRoleEnum.LabDirector || 
                                                                    m.projectRoleName === 'Lab Director' || 
                                                                    m.roleName === 'Lab Director') && !isCollaborator) || isAssignee) ? 0.5 : 1
                                                        }}
                                                    >
                                                        Collaborate
                                                    </button>
                                                </div>
                                            )}

                                            {isReadOnly && (isAssignee || isCollaborator) && (
                                                <div style={{
                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800,
                                                    background: isAssignee ? 'var(--primary-color)' : '#10b981', color: 'white'
                                                }}>
                                                    {isAssignee ? 'Primary' : 'Support'}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </form>




                {/* Footer */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '14px',
                    background: 'white'
                }}>
                    <button type="button" onClick={onClose} disabled={submitting} className="btn btn-secondary" style={{ padding: '0.75rem 1.75rem', borderRadius: '12px' }}>Cancel</button>
                    <button 
                        type="submit" 
                        form="create-task-form" 
                        className="btn btn-primary" 
                        disabled={submitting}
                        style={{ 
                            padding: '0.75rem 3rem', 
                            borderRadius: '12px', 
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            minWidth: '180px'
                        }}
                    >
                        {submitting ? (
                            <>
                                <Clock className="animate-spin-slow" size={18} />
                                {isEdit ? 'Updating...' : 'Creating...'}
                            </>
                        ) : (
                            isReadOnly ? 'Save Evidence' : (isEdit ? 'Update Task' : 'Create Task')
                        )}
                    </button>
                </div>
            </div >
        </div >
    );
};

export default TaskFormModal;
