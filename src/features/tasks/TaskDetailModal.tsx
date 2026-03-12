import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, 
    Activity, 
    Users, 
    Search,
    FileText,
    Save,
    AlertCircle,
    Trash2,
    MapPin
} from 'lucide-react';
import { Task, TaskStatus, Priority, ProjectRoleEnum, ProjectMember } from '@/types';
import { taskService, projectService, milestoneService, membershipService } from '@/services';
import { useAuth } from '@/hooks/useAuth';

interface TaskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    taskId: string | null;
    projectMembers?: ProjectMember[];
    milestones?: Milestone[];
    onTaskUpdated?: () => void;
}

import { Milestone, MilestoneStatus } from '@/types/milestone';

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ 
    isOpen, 
    onClose, 
    taskId, 
    projectMembers,
    milestones,
    onTaskUpdated
}) => {
    const { user: currentUser } = useAuth();
    const [task, setTask] = useState<Task | null>(null);
    const [projectRole, setProjectRole] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Internal data states for when props aren't provided
    const [internalMembers, setInternalMembers] = useState<ProjectMember[]>([]);
    const [internalMilestones, setInternalMilestones] = useState<Milestone[]>([]);

    // Determine which data to use (prop vs internal)
    const effectiveMembers = projectMembers || internalMembers;
    const effectiveMilestones = milestones || internalMilestones;

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
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    
    // Milestone search and filter states
    const [milestoneSearchTerm, setMilestoneSearchTerm] = useState('');
    const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<string>('all');

    const isAdmin = currentUser?.role === 'Admin';
    const isAuthorizedToEdit = isAdmin || 
        projectRole === ProjectRoleEnum.Leader || 
        projectRole === ProjectRoleEnum.LabDirector;

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
                    setMilestoneId(data.milestoneId || '');
                    setMemberId(data.memberId || '');
                    setStartDate(data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '');
                    setDueDate(data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : '');
                    setSupportMemberIds(data.members?.map((m: any) => m.id || m.memberId) || []);
                    setIsEditMode(false); // Default to read-only
                    setEvidenceFiles([]);

                    if (data.projectId) {
                        const [memberInfo, projMembers, projMilestones] = await Promise.all([
                            projectService.getCurrentMember(data.projectId),
                            projectMembers ? Promise.resolve(null) : membershipService.getProjectMembers(data.projectId),
                            milestones ? Promise.resolve(null) : milestoneService.getByProject(data.projectId)
                        ]);
                        
                        setProjectRole(memberInfo?.projectRole || null);
                        if (projMembers) setInternalMembers(projMembers);
                        if (projMilestones) setInternalMilestones(projMilestones);
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
        if (!memberSearchTerm.trim()) return effectiveMembers;
        const term = memberSearchTerm.toLowerCase();
        return effectiveMembers.filter(m =>
            (m.fullName || m.userName || '').toLowerCase().includes(term)
        );
    }, [effectiveMembers, memberSearchTerm]);

    const filteredMilestones = useMemo(() => {
        let list = effectiveMilestones;
        
        // Always include the currently selected milestone in the list even if it doesn't match filters
        const currentMilestone = effectiveMilestones.find(m => m.id === milestoneId);
        
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
        if (currentMilestone && !list.some(m => m.id === milestoneId)) {
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setEvidenceFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
    };

    const toggleSupportMember = (id: string) => {
        if (isEditMode) {
            if (supportMemberIds.includes(id)) {
                setSupportMemberIds(supportMemberIds.filter(mId => mId !== id));
            } else {
                setSupportMemberIds([...supportMemberIds, id]);
            }
        }
    };

    const handleDelete = async () => {
        if (!taskId) return;
        if (window.confirm("Are you sure you want to delete this activity? This action cannot be undone.")) {
            try {
                setLoading(true);
                await taskService.delete(taskId);
                onTaskUpdated?.();
                onClose();
            } catch (err) {
                console.error("Failed to delete task:", err);
                alert("Failed to delete activity. Please try again.");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskId) return;

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
                supportMembers: supportMemberIds
            };

            await taskService.update(taskId, { ...taskData, projectId: task?.projectId });
            
            // If there's evidence, we might need a separate API call depending on backend
            // For now, let's assume update handles it or we show a toast
            
            onTaskUpdated?.();
            setIsEditMode(false);
            
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
            }
        } catch (err) {
            console.error("Failed to update task:", err);
            alert("Failed to update activity. Please try again.");
        } finally {
            setLoading(false);
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
                maxWidth: '1100px', maxHeight: '92vh',
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
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ID: {taskId?.slice(-8).toUpperCase()}</p>
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
                                                setMilestoneId(task.milestoneId || '');
                                                setMemberId(task.memberId || '');
                                                setStartDate(task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
                                                setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
                                                setSupportMemberIds(task.members?.map((m: any) => m.id || m.memberId) || []);
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

                {/* Body */}
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
                                            <option value={TaskStatus.Rejected}>Rejected</option>
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
                                                    <option key={m.id} value={m.id}>
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
                                            {effectiveMilestones.find(m => m.id === milestoneId)?.name || 'No Associated Milestone'}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Start Date</label>
                                        <input 
                                            type="date"
                                            disabled={!isEditMode}
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            style={{ padding: '0.85rem 1.15rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: isEditMode ? 'white' : '#f8fafc' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Deadline</label>
                                        <input 
                                            type="date"
                                            disabled={!isEditMode}
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            style={{ padding: '0.85rem 1.15rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: isEditMode ? 'white' : '#f8fafc' }}
                                        />
                                    </div>
                                </div>

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

                                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        {evidenceFiles.map((file, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                <FileText size={14} color="#64748b" />
                                                <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                                <button type="button" onClick={() => removeFile(i)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                                            </div>
                                        ))}

                                        <label style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                                            background: 'var(--primary-color)', color: 'white', borderRadius: '10px',
                                            fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                                            boxShadow: '0 4px 6px rgba(37, 99, 235, 0.15)'
                                        }}>
                                            <Search size={14} /> Browse Files
                                            <input type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                                        </label>
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
                                     {filteredMembers.length === 0 ? (
                                        <p style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.85rem' }}>No members found.</p>
                                    ) : (
                                        filteredMembers.map((m) => {
                                            const mId = m.memberId || m.id || '';
                                            const isAssignee = memberId === mId;
                                            const isCollaborator = supportMemberIds.includes(mId);
                                            
                                            if (!isEditMode && !isAssignee && !isCollaborator) return null;

                                            return (
                                                <div key={mId} style={{
                                                    display: 'flex', alignItems: 'center', padding: '12px', borderRadius: '14px',
                                                    marginBottom: '6px', background: isAssignee ? '#eff6ff' : 'transparent',
                                                    border: isAssignee ? '1px solid #dbeafe' : '1px solid transparent'
                                                }}>
                                                     <div style={{
                                                        width: '38px', height: '38px', borderRadius: '50%',
                                                        background: 'var(--primary-color)', color: 'white',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.85rem', fontWeight: 800, marginRight: '12px'
                                                    }}>
                                                        {(m.fullName || m.userName || '?')[0].toUpperCase()}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{m.fullName || m.userName}</p>
                                                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>{m.roleName || 'Researcher'}</p>
                                                    </div>

                                                    {isEditMode ? (
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setMemberId(isAssignee ? '' : mId)}
                                                                style={{ 
                                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800,
                                                                    border: '1.5px solid', borderColor: isAssignee ? 'var(--primary-color)' : '#e2e8f0',
                                                                    background: isAssignee ? 'var(--primary-color)' : 'white',
                                                                    color: isAssignee ? 'white' : '#64748b', cursor: 'pointer'
                                                                }}
                                                            >Assign</button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => toggleSupportMember(mId)}
                                                                style={{ 
                                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800,
                                                                    border: '1.5px solid', borderColor: isCollaborator ? '#10b981' : '#e2e8f0',
                                                                    background: isCollaborator ? '#10b981' : 'white',
                                                                    color: isCollaborator ? 'white' : '#64748b', cursor: 'pointer'
                                                                }}
                                                            >Collab</button>
                                                        </div>
                                                    ) : (
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
                    padding: '1.25rem 2rem', borderTop: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'flex-end', gap: '14px', background: 'white',
                    alignItems: 'center'
                }}>
                    {isAuthorizedToEdit && (
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
                    <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '0.75rem 2rem', borderRadius: '12px' }}>Close Window</button>
                    {(isEditMode || (!error && evidenceFiles.length > 0)) && (
                        <button type="submit" onClick={handleSave} className="btn btn-primary" style={{ padding: '0.75rem 3rem', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isEditMode ? <Save size={18} /> : null}
                            {isEditMode ? 'Save Changes' : 'Upload Evidence'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskDetailModal;
