import React, { useState, useEffect } from 'react';
import { X, Calendar, AlignLeft, Flag } from 'lucide-react';
import { Milestone, MilestoneStatus } from '@/types';

interface MilestoneFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (milestoneData: any) => void;
    milestone?: Milestone | null;
}

const MilestoneFormModal: React.FC<MilestoneFormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    milestone = null
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [status, setStatus] = useState<MilestoneStatus>(MilestoneStatus.NotStarted);

    const resetForm = () => {
        setName('');
        setDescription('');
        setStartDate('');
        setDueDate('');
        setStatus(MilestoneStatus.NotStarted);
    };

    useEffect(() => {
        if (milestone && isOpen) {
            setName(milestone.name || '');
            setDescription(milestone.description || '');
            // Fix timezone shift
            setStartDate(milestone.startDate ? (milestone.startDate as string).split('T')[0] : '');
            setDueDate(milestone.dueDate ? (milestone.dueDate as string).split('T')[0] : '');
            setStatus(milestone.status);
        } else if (!isOpen) {
            resetForm();
        }
    }, [milestone, isOpen]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const milestoneData = {
            name,
            description,
            startDate: startDate ? new Date(startDate).toISOString() : null,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            status
        };
        onSubmit(milestoneData);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '20px'
        }}>
            <div style={{
                background: 'white', border: '1px solid #e2e8f0', borderRadius: '24px',
                width: '100%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'linear-gradient(to right, #ffffff, #f8fafc)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: 'rgba(232, 114, 12, 0.1)', color: '#E8720C',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Flag size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
                                {milestone ? 'Edit Milestone' : 'New Milestone'}
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                {milestone ? 'Update existing project phase' : 'Define a new project phase'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        border: 'none', background: '#f1f5f9', color: '#64748b',
                        padding: '8px', borderRadius: '10px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleFormSubmit} style={{ padding: '2rem', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Milestone Name */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Milestone Name</label>
                            <input
                                type="text"
                                placeholder="e.g., Initial Research, Data Collection Phase"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                style={{
                                    padding: '0.85rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                    fontSize: '0.95rem', outline: 'none', transition: 'all 0.2s', fontWeight: 500
                                }}
                            />
                        </div>

                        {/* Description */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlignLeft size={14} /> Description
                                </div>
                            </label>
                            <textarea
                                placeholder="Describe the objectives and deliverables for this milestone..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                style={{
                                    padding: '0.85rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                    fontSize: '0.95rem', outline: 'none', minHeight: '120px', resize: 'vertical',
                                    fontFamily: 'inherit', fontWeight: 500
                                }}
                            />
                        </div>

                        {/* Status & Dates */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(Number(e.target.value))}
                                    style={{
                                        padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                        background: 'white', cursor: 'pointer', fontWeight: 600
                                    }}
                                >
                                    <option value={MilestoneStatus.NotStarted}>Not Started</option>
                                    <option value={MilestoneStatus.InProgress}>In Progress</option>
                                    <option value={MilestoneStatus.Completed}>Completed</option>
                                    <option value={MilestoneStatus.OnHold}>On Hold</option>
                                    <option value={MilestoneStatus.Cancelled}>Cancelled</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Calendar size={14} /> Start Date
                                    </div>
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    required
                                    style={{
                                        padding: '0.85rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                        fontSize: '0.95rem', outline: 'none', fontWeight: 600
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Calendar size={14} /> Due Date
                                    </div>
                                </label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    required
                                    style={{
                                        padding: '0.85rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                        fontSize: '0.95rem', outline: 'none', fontWeight: 600
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                        marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '12px'
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '0.85rem 2rem', borderRadius: '12px', border: '1px solid #e2e8f0',
                                background: 'white', color: '#64748b', fontWeight: 700, cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                padding: '0.85rem 3rem', borderRadius: '12px', border: 'none',
                                background: '#E8720C', color: 'white', fontWeight: 800, cursor: 'pointer',
                                boxShadow: '0 10px 15px -3px rgba(232, 114, 12, 0.3)'
                            }}
                        >
                            {milestone ? 'Save Milestone' : 'Create Milestone'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MilestoneFormModal;
