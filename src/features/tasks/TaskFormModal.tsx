import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Users, Check, Calendar, Flag, Activity, AlignLeft, AlertTriangle, MapPin } from 'lucide-react';
import { Priority, TaskStatus, ProjectMember, Task } from '@/types';

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
}

import { Milestone, MilestoneStatus } from '@/types/milestone';
import { milestoneService, membershipService } from '@/services';

const TaskFormModal: React.FC<TaskFormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    projectMembers,
    initialStatus = TaskStatus.Todo,
    task = null,
    isReadOnly = false,
    onEvidenceUpload,
    milestones
}) => {
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

    // UI State for custom warning
    const [showAssigneeWarning, setShowAssigneeWarning] = useState(false);

    // Search states for members
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    
    // Milestone search and filter states
    const [milestoneSearchTerm, setMilestoneSearchTerm] = useState('');
    const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<string>('all');

    // Internal data states for when props aren't provided
    const [internalMembers, setInternalMembers] = useState<ProjectMember[]>([]);
    const [internalMilestones, setInternalMilestones] = useState<Milestone[]>([]);

    // Determine which data to use (prop vs internal)
    const effectiveMembers = projectMembers || internalMembers;
    const effectiveMilestones = milestones || internalMilestones;

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
        setMilestoneId('');
        setShowAssigneeWarning(false);
        setEvidenceFiles([]);
    };

    const executeSubmit = () => {
        const taskData = {
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

        if (isReadOnly && onEvidenceUpload && evidenceFiles.length > 0) {
            onEvidenceUpload(evidenceFiles);
            setEvidenceFiles([]);
            return;
        }

        onSubmit(taskData);
        if (!task) resetForm(); // Only reset if creating new
        onClose();
    };

    const toggleSupportMember = (id: string) => {
        if (supportMemberIds.includes(id)) {
            setSupportMemberIds(supportMemberIds.filter(mId => mId !== id));
        } else {
            setSupportMemberIds([...supportMemberIds, id]);
        }
    };

    useEffect(() => {
        if (task && isOpen) {
            setName(task.name || '');
            setDescription(task.description || '');
            setPriority(task.priority);
            setStatus(task.status);
            setMemberId(task.memberId || '');
            setStartDate(task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
            setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
            setMilestoneId((task as any).milestoneId || '');
            setSupportMemberIds(task.members?.map((m: any) => m.userId || m.memberId) || []);

            // If we don't have members or milestones, fetch them for this task's project
            if (task.projectId) {
                if (!projectMembers) {
                    membershipService.getProjectMembers(task.projectId).then(setInternalMembers);
                }
                if (!milestones) {
                    milestoneService.getByProject(task.projectId).then(setInternalMilestones);
                }
            }
        } else if (!isOpen) {
            resetForm();
        }
    }, [task, isOpen, initialStatus, projectMembers, milestones]);

    const filteredMembers = useMemo(() => {
        if (!memberSearchTerm.trim()) return effectiveMembers;
        const term = memberSearchTerm.toLowerCase();
        return effectiveMembers.filter(m =>
            (m.fullName || m.userName || '').toLowerCase().includes(term)
        );
    }, [effectiveMembers, memberSearchTerm]);

    const filteredMilestones = useMemo(() => {
        let list = effectiveMilestones;
        
        // Always include the currently selected milestone in the list even if it doesn't match filters
        const currentMilestone = effectiveMilestones.find(m => m.milestoneId === milestoneId);
        
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            padding: '10px',
                            background: 'var(--primary-color)',
                            borderRadius: '12px',
                            color: 'white',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                        }}>
                            <Activity size={20} />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
                            {isReadOnly ? 'Research Activity Details' : (isEdit ? 'Update Task Activity' : 'New Task Activity')}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ border: 'none', background: '#f8fafc', cursor: 'pointer', color: '#64748b', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body - 2 Column Layout */}
                <form id="create-task-form" onSubmit={handleSubmit} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
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
                                <Activity size={14} /> Activity Name *
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
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Activity size={14} /> Evidence & Documentation
                                </label>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {evidenceFiles.map((file, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.75rem' }}>
                                            <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                            <button type="button" onClick={() => removeFile(i)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
                                        </div>
                                    ))}

                                    <label style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
                                        background: 'white', border: '1.5px solid var(--primary-color)', borderRadius: '8px',
                                        color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                                    }}>
                                        <Search size={14} /> Add Files
                                        <input type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                                    </label>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Upload PDFs, Images, or Documents as evidence for this activity.</p>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Flag size={14} /> Priority
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
                                    {isEdit && <option value={TaskStatus.Submitted}>Submitted</option>}
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
                                    <option value="all">All Phases</option>
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} /> Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    disabled={isReadOnly}
                                    style={{ padding: '0.85rem 1.15rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', background: isReadOnly ? '#f8fafc' : 'white' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} /> Deadline
                                </label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    disabled={isReadOnly}
                                    style={{ padding: '0.85rem 1.15rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', background: isReadOnly ? '#f8fafc' : 'white' }}
                                />
                            </div>
                        </div>
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
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '50%',
                                                background: 'var(--primary-color)', color: 'white',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.8rem', fontWeight: 800, marginRight: '12px', flexShrink: 0,
                                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                                            }}>
                                                {(m.fullName || m.userName || '?')[0].toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p
                                                    title={m.fullName || m.userName}
                                                    style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                >
                                                    {m.fullName || m.userName}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>{m.roleName || 'Researcher'}</p>
                                            </div>

                                            {!isReadOnly && (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setMemberId(isAssignee ? '' : mId)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800,
                                                            border: '1.5px solid',
                                                            borderColor: isAssignee ? 'var(--primary-color)' : '#e2e8f0',
                                                            background: isAssignee ? 'var(--primary-color)' : 'white',
                                                            color: isAssignee ? 'white' : '#64748b',
                                                            cursor: 'pointer', transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        Assign
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSupportMember(mId)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800,
                                                            border: '1.5px solid',
                                                            borderColor: isCollaborator ? '#10b981' : '#e2e8f0',
                                                            background: isCollaborator ? '#10b981' : 'white',
                                                            color: isCollaborator ? 'white' : '#64748b',
                                                            cursor: 'pointer', transition: 'all 0.2s'
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
                    <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '0.75rem 1.75rem', borderRadius: '12px' }}>Cancel</button>
                    <button type="submit" form="create-task-form" className="btn btn-primary" style={{ padding: '0.75rem 3rem', borderRadius: '12px', fontWeight: 800 }}>
                        {isReadOnly ? 'Save Evidence' : (isEdit ? 'Update Activity' : 'Create Activity')}
                    </button>
                </div>
            </div >
        </div >
    );
};

export default TaskFormModal;
