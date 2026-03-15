import React, { useState, useEffect } from 'react';
import {
    X,
    Calendar,
    AlignLeft,
    Flag,
    Clock,
    CheckCircle2,
    AlertCircle,
    Edit3,
    Trash2,
    Activity,
    ChevronRight,
    Save,
    Search,
    SearchX
} from 'lucide-react';
import { Milestone, MilestoneStatus, Task, TaskStatus } from '@/types';
import { milestoneService } from '@/services';
import TaskDetailModal from '../tasks/TaskDetailModal';

interface MilestoneDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    milestoneId: string | null;
    onMilestoneUpdated: () => void;
    canManage: boolean;
}

const MilestoneDetailModal: React.FC<MilestoneDetailModalProps> = ({
    isOpen,
    onClose,
    milestoneId,
    onMilestoneUpdated,
    canManage
}) => {
    const [milestone, setMilestone] = useState<Milestone | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [taskSearchTerm, setTaskSearchTerm] = useState('');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

    // Form states for editing
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<MilestoneStatus>(MilestoneStatus.NotStarted);
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');

    useEffect(() => {
        if (isOpen && milestoneId) {
            fetchMilestoneDetails();
        } else if (!isOpen) {
            setIsEditMode(false);
        }
    }, [isOpen, milestoneId]);

    const formatDate = (dateString: string | undefined | null) => {
        if (!dateString || dateString.startsWith('0001-01-01')) return "Not set";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "Invalid Date";
        return date.toLocaleDateString('vi-VN');
    };

    const fetchMilestoneDetails = async () => {
        if (!milestoneId) return;
        setLoading(true);
        try {
            const [data, milestoneTasks] = await Promise.all([
                milestoneService.getById(milestoneId),
                milestoneService.getTasksByMilestone(milestoneId)
            ]);

            if (data) {
                setMilestone(data);
                setTasks(milestoneTasks || []);
                // Populate Edit Form
                setName(data.name || '');
                setDescription(data.description || '');
                setStatus(data.status);

                // Fix timezone shift: extract YYYY-MM-DD directly from the ISO string
                setStartDate(data.startDate ? data.startDate.split('T')[0] : '');
                setDueDate(data.dueDate ? data.dueDate.split('T')[0] : '');
            }
        } catch (error) {
            console.error("Failed to fetch milestone details:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!milestoneId) return;
        setLoading(true);
        try {
            const milestoneData = {
                name,
                description,
                startDate: startDate ? new Date(startDate).toISOString() : null,
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                status
            };
            await milestoneService.update(milestoneId, milestoneData);
            await fetchMilestoneDetails();
            setIsEditMode(false);
            onMilestoneUpdated();
        } catch (error) {
            console.error("Failed to update milestone:", error);
            alert("Failed to update milestone. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!milestoneId) return;
        if (window.confirm("Are you sure you want to delete this milestone? All associated data might be affected.")) {
            try {
                await milestoneService.delete(milestoneId);
                onMilestoneUpdated();
                onClose();
            } catch (error) {
                console.error("Failed to delete milestone:", error);
                alert("Failed to delete milestone. Please try again.");
            }
        }
    };

    const filteredTasks = tasks.filter(task =>
        task.name?.toLowerCase().includes(taskSearchTerm.toLowerCase())
    );

    const handleTaskClick = (taskId: string) => {
        setSelectedTaskId(taskId);
        setIsTaskDetailOpen(true);
    };

    const getStatusStyle = (status: MilestoneStatus) => {
        switch (status) {
            case MilestoneStatus.NotStarted: return { color: '#64748b', bg: '#f1f5f9', label: 'Not Started', icon: <Clock size={18} /> };
            case MilestoneStatus.InProgress: return { color: '#0288d1', bg: '#e1f5fe', label: 'In Progress', icon: <Activity size={18} /> };
            case MilestoneStatus.Completed: return { color: '#10b981', bg: '#ecfdf5', label: 'Completed', icon: <CheckCircle2 size={18} /> };
            case MilestoneStatus.OnHold: return { color: '#f59e0b', bg: '#fffbeb', label: 'On Hold', icon: <AlertCircle size={18} /> };
            case MilestoneStatus.Cancelled: return { color: '#ef4444', bg: '#fef2f2', label: 'Cancelled', icon: <AlertCircle size={18} /> };
            default: return { color: '#64748b', bg: '#f1f5f9', label: 'Not Started', icon: <Clock size={18} /> };
        }
    };

    const getTaskStatusInfo = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.Todo: return { label: 'To Do', color: '#64748b' };
            case TaskStatus.InProgress: return { label: 'In Progress', color: '#0ea5e9' };
            case TaskStatus.Submitted: return { label: 'Submitted', color: '#7c3aed' };
            case TaskStatus.Missed: return { label: 'Missed', color: '#ef4444' };
            case TaskStatus.Adjusting: return { label: 'Adjusting', color: '#f59e0b' };
            case TaskStatus.Completed: return { label: 'Completed', color: '#10b981' };
            default: return { label: 'In Progress', color: '#0ea5e9' };
        }
    };

    if (!isOpen) return null;

    const currentStatus = isEditMode ? status : (milestone?.status || MilestoneStatus.NotStarted);
    const statusStyle = getStatusStyle(currentStatus);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '20px'
        }}>
            <div style={{
                background: 'white', border: '1px solid #e2e8f0', borderRadius: '24px',
                width: '100%', maxWidth: '900px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'linear-gradient(to right, #ffffff, #f8fafc)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '14px',
                            background: statusStyle.bg, color: statusStyle.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Flag size={24} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
                                    {loading ? 'Processing...' : (isEditMode ? 'Edit Milestone Phase' : milestone?.name)}
                                </h2>
                                {!loading && (
                                    <span style={{
                                        fontSize: '0.7rem', padding: '4px 10px', borderRadius: '20px',
                                        background: statusStyle.bg, color: statusStyle.color,
                                        fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px'
                                    }}>
                                        {statusStyle.icon} {statusStyle.label}
                                    </span>
                                )}
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                Project Roadmap Milestone
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {/* THE TOGGLE ("CÁI GẠT") */}
                        {canManage && !loading && milestone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '6px 14px', borderRadius: '30px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isEditMode ? 'var(--primary-color)' : '#64748b' }}>
                                    {isEditMode ? 'EDITING MODE' : 'VIEW MODE'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsEditMode(!isEditMode)}
                                    style={{
                                        width: '44px', height: '22px', borderRadius: '11px',
                                        background: isEditMode ? '#E8720C' : '#cbd5e1',
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

                        <button onClick={onClose} style={{
                            border: 'none', background: '#f1f5f9', color: '#64748b',
                            padding: '8px', borderRadius: '10px', cursor: 'pointer'
                        }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <div className="loader"></div>
                        </div>
                    ) : milestone ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2.5rem' }}>
                            {/* Left Side: Info & Tasks or Form */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {isEditMode ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Milestone Name</label>
                                            <input
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                placeholder="Enter milestone title..."
                                                style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '1rem', outline: 'none' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Description</label>
                                            <textarea
                                                value={description}
                                                onChange={e => setDescription(e.target.value)}
                                                placeholder="Describe the goals..."
                                                rows={5}
                                                style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', resize: 'none' }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>
                                                <AlignLeft size={16} /> Description
                                            </h4>
                                            <p style={{ margin: 0, color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                                {milestone.description || "No description provided for this milestone."}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>
                                                <Activity size={16} /> Progress
                                            </h4>
                                            <div style={{ background: '#f1f5f9', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '1rem' }}>
                                                <div style={{
                                                    width: `${milestone.progress || (milestone.status === MilestoneStatus.Completed ? 100 : 0)}%`,
                                                    height: '100%',
                                                    background: 'linear-gradient(90deg, #E8720C, #f97316)',
                                                    transition: 'width 0.5s ease'
                                                }} />
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', textAlign: 'right' }}>
                                                {milestone.progress || (milestone.status === MilestoneStatus.Completed ? 100 : 0)}% Completed
                                            </p>
                                        </div>

                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>
                                                    <Activity size={16} /> Associated Research Tasks ({tasks.length})
                                                </h4>

                                                {tasks.length > 0 && (
                                                    <div style={{ position: 'relative', width: '200px' }}>
                                                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                        <input
                                                            type="text"
                                                            placeholder="Search by name..."
                                                            value={taskSearchTerm}
                                                            onChange={(e) => setTaskSearchTerm(e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '6px 10px 6px 30px',
                                                                borderRadius: '20px',
                                                                border: '1.5px solid #e2e8f0',
                                                                fontSize: '0.75rem',
                                                                outline: 'none',
                                                                transition: 'border-color 0.2s'
                                                            }}
                                                            onFocus={(e) => e.target.style.borderColor = '#E8720C'}
                                                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '10px',
                                                height: '168px', /* Fixed height for 2 tasks to prevent layout shift */
                                                overflowY: 'auto',
                                                paddingRight: '6px',
                                                scrollbarWidth: 'thin',
                                                scrollbarColor: '#cbd5e1 transparent'
                                            }}>
                                                {filteredTasks.length > 0 ? filteredTasks.map(task => {
                                                    const taskInfo = getTaskStatusInfo(task.status);
                                                    return (
                                                        <div
                                                            key={task.id}
                                                            onClick={() => handleTaskClick(task.id)}
                                                            style={{
                                                                padding: '0.9rem 1.15rem', borderRadius: '14px', border: '1px solid #f1f5f9',
                                                                background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                                                flexShrink: 0
                                                            }}
                                                            onMouseOver={(e) => {
                                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                                e.currentTarget.style.borderColor = '#E8720C';
                                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                                                                e.currentTarget.style.background = 'white';
                                                            }}
                                                            onMouseOut={(e) => {
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                                e.currentTarget.style.borderColor = '#f1f5f9';
                                                                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
                                                                e.currentTarget.style.background = '#f8fafc';
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: taskInfo.color, boxShadow: `0 0 0 3px ${taskInfo.color}15` }} />
                                                                <div>
                                                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', display: 'block' }}>{task.name}</span>
                                                                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Status: <span style={{ color: taskInfo.color }}>{taskInfo.label}</span></span>
                                                                </div>
                                                            </div>
                                                            <ChevronRight size={16} color="#94a3b8" />
                                                        </div>
                                                    );
                                                }) : (
                                                    <div style={{ 
                                                        height: '100%',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: '#f8fafc', 
                                                        borderRadius: '16px', 
                                                        border: '1px dashed #e2e8f0' 
                                                    }}>
                                                        {taskSearchTerm ? (
                                                            <>
                                                                <SearchX size={32} color="#94a3b8" style={{ marginBottom: '10px' }} />
                                                                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>No results match "{taskSearchTerm}"</p>
                                                            </>
                                                        ) : (
                                                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>No activities in this phase.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Right Side: Metadata or Form Controls */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Timeline & Status</h4>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        {isEditMode && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>STATUS</label>
                                                <select
                                                    value={status}
                                                    onChange={e => setStatus(Number(e.target.value))}
                                                    style={{ padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 600, outline: 'none' }}
                                                >
                                                    <option value={MilestoneStatus.NotStarted}>Not Started</option>
                                                    <option value={MilestoneStatus.InProgress}>In Progress</option>
                                                    <option value={MilestoneStatus.Completed}>Completed</option>
                                                    <option value={MilestoneStatus.OnHold}>On Hold</option>
                                                    <option value={MilestoneStatus.Cancelled}>Cancelled</option>
                                                </select>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', color: '#1e293b' }}>
                                                <Calendar size={16} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', marginBottom: isEditMode ? '4px' : '0' }}>Start Date</p>
                                                {isEditMode ? (
                                                    <input
                                                        type="date"
                                                        value={startDate}
                                                        onChange={e => setStartDate(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '6px 10px',
                                                            borderRadius: '8px',
                                                            border: '1.5px solid #e2e8f0',
                                                            background: 'white',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 600,
                                                            outline: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                    />
                                                ) : (
                                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{formatDate(milestone.startDate)}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', color: '#E8720C' }}>
                                                <Calendar size={16} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', marginBottom: isEditMode ? '4px' : '0' }}>Due Date</p>
                                                {isEditMode ? (
                                                    <input
                                                        type="date"
                                                        value={dueDate}
                                                        onChange={e => setDueDate(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '6px 10px',
                                                            borderRadius: '8px',
                                                            border: '1.5px solid #e2e8f0',
                                                            background: 'white',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 600,
                                                            outline: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                    />
                                                ) : (
                                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{formatDate(milestone.dueDate)}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {!isEditMode && milestone.createdAt && (
                                    <div style={{ padding: '0 0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                                        <p>Registered on {formatDate(milestone.createdAt)}</p>
                                        {milestone.updatedAt && <p>Last updated on {formatDate(milestone.updatedAt)}</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
                            <p>Milestone data not found.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1.25rem 2rem', borderTop: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'white',
                    alignItems: 'center'
                }}>
                    {canManage && !isEditMode && (
                        <button
                            onClick={handleDelete}
                            style={{
                                padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid #fee2e2',
                                background: '#fef2f2', color: '#ef4444', fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                marginRight: 'auto'
                            }}
                        >
                            <Trash2 size={18} /> Delete Phase
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="btn btn-secondary"
                        style={{ padding: '0.75rem 2rem', borderRadius: '12px' }}
                    >
                        {isEditMode ? 'Discard Changes' : 'Close Window'}
                    </button>

                    {isEditMode ? (
                        <button
                            onClick={handleSave}
                            className="btn btn-primary"
                            style={{ padding: '0.75rem 3rem', borderRadius: '12px', background: '#E8720C', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Save size={18} /> Save Milestone
                        </button>
                    ) : (
                        canManage && (
                            <button
                                onClick={() => setIsEditMode(true)}
                                className="btn btn-primary"
                                style={{ padding: '0.75rem 3rem', borderRadius: '12px' }}
                            >
                                <Edit3 size={18} /> Edit Mode
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Nested Task Details */}
            <TaskDetailModal
                isOpen={isTaskDetailOpen}
                onClose={() => setIsTaskDetailOpen(false)}
                taskId={selectedTaskId}
                onTaskUpdated={fetchMilestoneDetails}
            />
        </div>
    );
};

export default MilestoneDetailModal;
