import React, { useState, useEffect } from 'react';
import { X, Calendar, AlignLeft, Flag, Plus, Trash2 } from 'lucide-react';
import { Milestone, MilestoneStatus } from '@/types';
import MilestoneRoadmapPreview from './MilestoneRoadmapPreview';

interface MilestoneRow {
    id: string; // for React keys
    name: string;
    description: string;
    startDate: string;
    dueDate: string;
    status: MilestoneStatus;
}

interface MilestoneFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (milestoneData: any | any[]) => void;
    milestone?: Milestone | null;
    existingMilestones?: Milestone[];
    projectStartDate?: string;
    projectEndDate?: string;
}

const MilestoneFormModal: React.FC<MilestoneFormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    milestone = null,
    existingMilestones = [],
    projectStartDate,
    projectEndDate
}) => {
    const [rows, setRows] = useState<MilestoneRow[]>([]);

    const createNewRow = (defaultStartDate: string = ''): MilestoneRow => ({
        id: Math.random().toString(36).substr(2, 9),
        name: '',
        description: '',
        startDate: defaultStartDate || '',
        dueDate: '',
        status: MilestoneStatus.NotStarted
    });

    const getLatestExistingDate = () => {
        if (!existingMilestones || existingMilestones.length === 0) return '';
        const sorted = [...existingMilestones].sort((a, b) => {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            return dateB - dateA;
        });
        const latest = sorted[0];
        if (!latest.dueDate) return '';
        return (latest.dueDate as string).split('T')[0];
    };

    const resetForm = () => {
        setRows([createNewRow(getLatestExistingDate())]);
    };

    useEffect(() => {
        if (milestone && isOpen) {
            setRows([{
                id: milestone.milestoneId,
                name: milestone.name || '',
                description: milestone.description || '',
                startDate: milestone.startDate ? (milestone.startDate as string).split('T')[0] : '',
                dueDate: milestone.dueDate ? (milestone.dueDate as string).split('T')[0] : '',
                status: milestone.status ?? MilestoneStatus.NotStarted
            }]);
        } else if (isOpen && !milestone) {
            resetForm();
        }
    }, [milestone, isOpen]);

    const addRow = () => {
        const lastRow = rows[rows.length - 1];
        const nextStartDate = lastRow?.dueDate || getLatestExistingDate();
        setRows([...rows, createNewRow(nextStartDate)]);
    };

    const removeRow = (id: string) => {
        if (rows.length > 1) {
            setRows(rows.filter((row: MilestoneRow) => row.id !== id));
        }
    };

    const updateRow = (id: string, field: keyof MilestoneRow, value: any) => {
        setRows(rows.map((row: MilestoneRow) => row.id === id ? { ...row, [field]: value } : row));
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const todayStr = new Date().toISOString().split('T')[0];

        if (milestone) {
            // Edit mode - return single object
            const row = rows[0];
            const finalStartDate = row.startDate || todayStr;
            const milestoneData = {
                name: row.name,
                description: row.description,
                startDate: new Date(finalStartDate).toISOString(),
                dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
                status: row.status
            };
            onSubmit(milestoneData);
        } else {
            // Create mode - return array
            const milestonesData = rows.map((row: MilestoneRow) => {
                const finalStartDate = row.startDate || todayStr;
                return {
                    name: row.name,
                    description: row.description,
                    startDate: new Date(finalStartDate).toISOString(),
                    dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
                    status: row.status
                };
            });
            onSubmit(milestonesData);
        }
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
                width: '100%', maxWidth: '850px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
                                {milestone ? 'Edit Phase' : 'Define Research Roadmap'}
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                {milestone ? 'Update existing project phase' : 'You can create multiple phases at once'}
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
                <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* Timeline Preview Component */}
                    <MilestoneRoadmapPreview
                        existingMilestones={existingMilestones.filter(m => !milestone || m.milestoneId !== milestone.milestoneId)}
                        currentMilestones={rows.filter((r: MilestoneRow) => r.startDate && r.dueDate).map((r: MilestoneRow) => ({
                            id: r.id,
                            name: r.name || `Phase ${rows.indexOf(r) + 1}`,
                            startDate: r.startDate,
                            dueDate: r.dueDate
                        }))}
                        projectStartDate={projectStartDate}
                        projectEndDate={projectEndDate}
                        highlightId={milestone?.milestoneId}
                    />

                    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {rows.map((row: MilestoneRow, index: number) => (
                            <div key={row.id} style={{
                                padding: '1.5rem',
                                background: '#f8fafc',
                                borderRadius: '16px',
                                border: '1.5px solid #e2e8f0',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                {!milestone && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#E8720C', textTransform: 'uppercase' }}>Phase {index + 1}</span>
                                        {rows.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRow(row.id)}
                                                style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700 }}
                                            >
                                                <Trash2 size={14} /> Remove Phase
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: milestone ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Phase Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g., Initial Research"
                                            value={row.name}
                                            onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                                            required
                                            style={{ padding: '0.8rem 1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                    </div>
                                    {milestone && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</label>
                                            <select
                                                value={row.status}
                                                onChange={(e) => updateRow(row.id, 'status', Number(e.target.value))}
                                                style={{ padding: '0.8rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 600, fontSize: '0.9rem' }}
                                            >
                                                <option value={MilestoneStatus.NotStarted}>Not Started</option>
                                                <option value={MilestoneStatus.InProgress}>In Progress</option>
                                                <option value={MilestoneStatus.Completed}>Completed</option>
                                                <option value={MilestoneStatus.OnHold}>On Hold</option>
                                                <option value={MilestoneStatus.Cancelled}>Cancelled</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '1.5rem' }}>
                                    {/* Description Column */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlignLeft size={14} /> Description</div>
                                        </label>
                                        <textarea
                                            placeholder="Describe the objectives and deliverables for this phase..."
                                            value={row.description}
                                            onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                                            style={{
                                                padding: '0.8rem 1rem',
                                                borderRadius: '10px',
                                                border: '1.5px solid #e2e8f0',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                minHeight: '104px',
                                                resize: 'none',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                    </div>

                                    {/* Dates Column - Vertical Stack */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> Start Date</div>
                                            </label>
                                            <input
                                                type="date"
                                                value={row.startDate}
                                                onChange={(e) => updateRow(row.id, 'startDate', e.target.value)}
                                                style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> Due Date</div>
                                            </label>
                                            <input
                                                type="date"
                                                value={row.dueDate}
                                                onChange={(e) => updateRow(row.id, 'dueDate', e.target.value)}
                                                style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {!milestone && (
                            <button
                                type="button"
                                onClick={addRow}
                                style={{
                                    padding: '1rem', border: '2px dashed #e2e8f0', borderRadius: '16px',
                                    background: 'white', color: '#64748b', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#E8720C'; e.currentTarget.style.color = '#E8720C'; }}
                                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                            >
                                <Plus size={20} /> Add Another Phase
                            </button>
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: '1.5rem 2rem', borderTop: '1px solid #f1f5f9',
                        display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'white'
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ padding: '0.85rem 2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                padding: '0.85rem 3.5rem', borderRadius: '12px', border: 'none',
                                background: '#E8720C', color: 'white', fontWeight: 800, cursor: 'pointer',
                                boxShadow: '0 10px 15px -3px rgba(232, 114, 12, 0.3)'
                            }}
                        >
                            {milestone ? 'Save Phase' : `Create ${rows.length} Phases`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MilestoneFormModal;
