import React, { useState } from 'react';
import { X, Calendar, Flag, User, Users, Plus } from 'lucide-react';
import { Priority, TaskStatus, ProjectMember } from '@/types';

interface TaskFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (taskData: any) => void;
    projectMembers: ProjectMember[];
    initialStatus?: TaskStatus;
}

const TaskFormModal: React.FC<TaskFormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    projectMembers,
    initialStatus = TaskStatus.Todo
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<Priority>(Priority.Medium);
    const [status, setStatus] = useState<TaskStatus>(initialStatus);
    const [memberId, setMemberId] = useState<string>('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [supportMemberIds, setSupportMemberIds] = useState<string[]>([]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // TaskMember format per UI needs usually is id + name, 
        // but for API creation it's often just memberId and then AddTaskMember for others
        const taskData = {
            name,
            description,
            priority,
            status,
            memberId: memberId || null,
            startDate: startDate ? new Date(startDate).toISOString() : null,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            supportMembers: supportMemberIds // We'll handle this in the service call logic
        };

        onSubmit(taskData);
        // Reset form
        setName('');
        setDescription('');
        setMemberId('');
        setSupportMemberIds([]);
        onClose();
    };

    const toggleSupportMember = (id: string) => {
        if (supportMemberIds.includes(id)) {
            setSupportMemberIds(supportMemberIds.filter(mId => mId !== id));
        } else {
            setSupportMemberIds([...supportMemberIds, id]);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                        Register Research Activity
                    </h2>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Task Name */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Activity Name *</label>
                        <input
                            required
                            type="text"
                            placeholder="e.g., Literature Review on Transformer Models"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    {/* Description */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Methodology / Scope</label>
                        <textarea
                            rows={3}
                            placeholder="Briefly describe the research task goals..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.95rem',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Priority */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                                <Flag size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Priority
                            </label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(Number(e.target.value))}
                                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}
                            >
                                <option value={Priority.Low}>Low Impact</option>
                                <option value={Priority.Medium}>Medium Impact</option>
                                <option value={Priority.High}>High Project Priority</option>
                                <option value={Priority.Urgent}>CRITICAL / URGENT</option>
                            </select>
                        </div>

                        {/* Status */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Initial Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(Number(e.target.value))}
                                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}
                            >
                                <option value={TaskStatus.Todo}>Backlog / To Do</option>
                                <option value={TaskStatus.InProgress}>Active Research</option>
                                <option value={TaskStatus.InReview}>Peer Review</option>
                                <option value={TaskStatus.Completed}>Archived / Completed</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Start Date */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                                <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            />
                        </div>

                        {/* Due Date */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                                <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Expected Deadline
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            />
                        </div>
                    </div>

                    {/* Primary Member */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                            <User size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Primary Researcher (Assignee)
                        </label>
                        <select
                            value={memberId}
                            onChange={(e) => setMemberId(e.target.value)}
                            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}
                        >
                            <option value="">Unassigned</option>
                            {projectMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.userName} ({m.projectRoleName})</option>
                            ))}
                        </select>
                    </div>

                    {/* Support Members (Task Members) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                            <Users size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Supporting Researchers (Collaboration Team)
                        </label>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                            maxHeight: '120px',
                            overflowY: 'auto',
                            padding: '4px'
                        }}>
                            {projectMembers.filter(m => m.id !== memberId).map(m => (
                                <div
                                    key={m.id}
                                    onClick={() => toggleSupportMember(m.id)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: '1px solid',
                                        borderColor: supportMemberIds.includes(m.id) ? 'var(--accent-color)' : '#e2e8f0',
                                        background: supportMemberIds.includes(m.id) ? 'var(--accent-color)' : 'white',
                                        color: supportMemberIds.includes(m.id) ? 'white' : '#64748b',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    {supportMemberIds.includes(m.id) && <Plus size={12} style={{ transform: 'rotate(45deg)' }} />}
                                    {m.userName}
                                </div>
                            ))}
                            {projectMembers.length <= 1 && (
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>No other members available for support.</p>
                            )}
                        </div>
                    </div>

                    <div style={{
                        marginTop: '1rem',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: '1.5rem'
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                            style={{ padding: '0.75rem 1.5rem' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ padding: '0.75rem 2rem' }}
                        >
                            Create Activity
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskFormModal;
