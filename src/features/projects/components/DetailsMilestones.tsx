import React from 'react';
import {
    Plus, Search, Calendar, Target, Edit3,
    Clock, Activity, CheckCircle2, X, User, Info,
    Save, Trash2, UserPlus, FileText, ChevronRight, ChevronDown
} from 'lucide-react';
import { Milestone, MilestoneStatus } from '@/types';
import MilestoneItem from '@/components/milestone/MilestoneItem';

interface TaskDraft {
    id: string; // Internal temporary ID
    name: string;
    description: string;
    priority: number; // Low=1, Medium=2, High=3
    status: number; // Todo=1
    startDate: string;
    dueDate: string;
    assigneeId: string;
    collaboratorIds: string[];
    isSaving: boolean;
    isExpanded: boolean;
}

interface DetailsMilestonesProps {
    projectId?: string;
    milestones: Milestone[];
    filteredMilestones: Milestone[];
    milestoneSearchQuery: string;
    setMilestoneSearchQuery: (query: string) => void;
    milestoneStatusFilter: string;
    setMilestoneStatusFilter: (filter: string) => void;
    canManageMilestones: boolean;
    isArchived: boolean;
    milestoneContainerRef: React.RefObject<HTMLDivElement>;
    handleMilestoneClick: (milestone: Milestone) => void;
    onDetailClick: (milestone: Milestone) => void;
    newMilestoneData: any;
    handleMilestoneDataChange: (field: string, value: any) => void;
    handleQuickMilestoneSave: () => void;
    checkOverlap: (start: string, due: string) => boolean;
    editingMilestoneId: string | null;
    onCancelEdit: () => void;
    clearMilestoneEdit?: () => void;
    viewMode: 'roadmap' | 'detail';
    activeMilestone: Milestone | null;
    members: any[];
    refreshTasks?: () => void;
}

type FormTab = 'view' | 'edit' | 'add';

const DetailsMilestones: React.FC<DetailsMilestonesProps> = ({
    projectId,
    milestones,
    filteredMilestones,
    milestoneSearchQuery,
    setMilestoneSearchQuery,
    milestoneStatusFilter,
    setMilestoneStatusFilter,
    canManageMilestones,
    isArchived,
    milestoneContainerRef,
    handleMilestoneClick,
    onDetailClick,
    newMilestoneData,
    handleMilestoneDataChange,
    handleQuickMilestoneSave,
    editingMilestoneId,
    onCancelEdit,
    clearMilestoneEdit,
    viewMode,
    activeMilestone,
    members,
    refreshTasks
}) => {
    const [formTab, setFormTab] = React.useState<FormTab>('view');
    const [draftTasks, setDraftTasks] = React.useState<TaskDraft[]>([]);
    const [confirmState, setConfirmState] = React.useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        message: '',
        onConfirm: () => { }
    });

    // Helper to format date to DD/MM/YYYY
    const formatDate = (dateInput: string | Date | null | undefined): string => {
        if (!dateInput) return "TBD";
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return "TBD";
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (e) {
            return "TBD";
        }
    };

    // Date range constraints for tasks
    const mDueDate = activeMilestone?.dueDate ? new Date(activeMilestone.dueDate).toISOString().split('T')[0] : '';

    // Task Draft Handlers
    const addDraftSlot = () => {
        const today = new Date().toISOString().split('T')[0];
        const newDraft: TaskDraft = {
            id: Math.random().toString(36).substr(2, 9),
            name: '',
            description: '',
            priority: 2, // Medium=2
            status: 1,   // Todo=1
            startDate: today,
            dueDate: mDueDate || today,
            assigneeId: '',
            collaboratorIds: [],
            isSaving: false,
            isExpanded: true
        };
        // Auto-collapse others when adding new
        setDraftTasks([newDraft, ...draftTasks.map(d => ({ ...d, isExpanded: false }))]);
    };

    const updateDraft = (id: string, field: keyof TaskDraft, value: any) => {
        setDraftTasks(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    const removeDraft = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDraftTasks(prev => prev.filter(d => d.id !== id));
    };

    const toggleDraftExpand = (id: string) => {
        setDraftTasks(prev => prev.map(d => d.id === id ? { ...d, isExpanded: !d.isExpanded } : { ...d, isExpanded: false }));
    };

    const handleSingleTaskSave = async (draft: TaskDraft) => {
        if (!draft.name || !activeMilestone) return;
        setDraftTasks(prev => prev.map(d => d.id === draft.id ? { ...d, isSaving: true } : d));

        // Final task object for API
        const taskPayload = {
            name: draft.name,
            description: draft.description,
            priority: draft.priority,
            status: draft.status,
            memberId: draft.assigneeId,
            milestoneId: activeMilestone.milestoneId,
            projectId: projectId,
            startDate: draft.startDate + "T00:00:00.000Z",
            dueDate: draft.dueDate + "T23:59:59.000Z",
            collaborators: draft.collaboratorIds
        };

        // Mock API Call
        console.log("Saving single task payload:", taskPayload);
        await new Promise(resolve => setTimeout(resolve, 800));

        setDraftTasks(prev => prev.filter(d => d.id !== draft.id));
        if (refreshTasks) refreshTasks();
    };

    const handleBulkTaskSave = async () => {
        const validDrafts = draftTasks.filter(d => d.name.trim() !== '' && d.assigneeId);
        if (validDrafts.length === 0 || !activeMilestone) return;

        setDraftTasks(prev => prev.map(d => ({ ...d, isSaving: true })));

        // Prepare payload for bulk API
        const payloads = validDrafts.map(draft => ({
            name: draft.name,
            description: draft.description,
            priority: draft.priority,
            status: draft.status,
            memberId: draft.assigneeId,
            milestoneId: activeMilestone.milestoneId,
            projectId: projectId,
            startDate: draft.startDate + "T00:00:00.000Z",
            dueDate: draft.dueDate + "T23:59:59.000Z"
        }));

        console.log("Saving bulk tasks payloads:", payloads);
        await new Promise(resolve => setTimeout(resolve, 1500));

        setDraftTasks([]);
        if (refreshTasks) refreshTasks();
    };

    // State Syncing
    React.useEffect(() => {
        if (viewMode === 'detail' && activeMilestone) {
            setFormTab('view');
            setDraftTasks([]); // Clear drafts when switching milestones
        } else if (viewMode === 'roadmap') {
            setFormTab('add');
        }
    }, [activeMilestone?.milestoneId, viewMode]);

    // Calc latest milestone date tip
    const latestMilestoneDate = React.useMemo(() => {
        if (!milestones || milestones.length === 0) return null;
        let latest = new Date(0);
        milestones.forEach(m => {
            const d = new Date(m.dueDate);
            if (d > latest) latest = d;
        });
        return latest.getTime() === 0 ? null : latest;
    }, [milestones]);


    const hasUnsavedChanges = React.useCallback(() => {
        if (formTab === 'view') return false;
        if (formTab === 'add') return !!newMilestoneData.name || !!newMilestoneData.description;
        if (formTab === 'edit' && activeMilestone) {
            // Check if name or description differs from the original milestone
            return newMilestoneData.name !== activeMilestone.name || (newMilestoneData.description || '') !== (activeMilestone.description || '');
        }
        return false;
    }, [formTab, newMilestoneData, activeMilestone]);

    const protectedCancelEdit = () => {
        // Mode: View/Edit (existing milestone)
        if (formTab !== 'add') {
            if (hasUnsavedChanges()) {
                setConfirmState({
                    isOpen: true,
                    message: 'Your unsaved changes will be lost. Return to list anyway?',
                    onConfirm: () => onCancelEdit()
                });
                return;
            }
            onCancelEdit();
            return;
        }

        // Mode: Add (new milestone draft)
        // If we are in "Add Mode" (Detail View with Tasks), going out clears the form
        if (viewMode === 'detail' && formTab === 'add') {
            // Clear then exit
            handleMilestoneDataChange('name', '');
            handleMilestoneDataChange('description', '');
            handleMilestoneDataChange('startDate', '');
            handleMilestoneDataChange('dueDate', '');
            onCancelEdit();
            return;
        }

        onCancelEdit();
    };

    const protectedMilestoneClick = (milestone: Milestone) => {
        // User explicitly said: "Chuyển từ view milestone này sang milestone khác thì không cần thông báo"
        // This applies regardless of current tab or changes
        handleMilestoneClick(milestone);
    };

    const handleSwitchToEdit = () => {
        if (activeMilestone) {
            handleMilestoneDataChange('name', activeMilestone.name);
            handleMilestoneDataChange('description', activeMilestone.description || '');
            handleMilestoneDataChange('startDate', activeMilestone.startDate ? new Date(activeMilestone.startDate).toISOString().split('T')[0] : '');
            handleMilestoneDataChange('dueDate', activeMilestone.dueDate ? new Date(activeMilestone.dueDate).toISOString().split('T')[0] : '');
            setFormTab('edit');
        }
    };

    const handleSwitchToAdd = () => {
        if (clearMilestoneEdit) clearMilestoneEdit();
        else onCancelEdit();
        setFormTab('add');
    };

    // Helper to get the "live" data of a milestone item in the list
    const getLiveMilestoneItem = (milestone: Milestone | null): any => {
        if (!milestone) return null;
        if (formTab === 'edit' && editingMilestoneId === milestone.milestoneId) {
            return {
                ...milestone,
                name: newMilestoneData.name || milestone.name,
                startDate: newMilestoneData.startDate || milestone.startDate,
                dueDate: newMilestoneData.dueDate || milestone.dueDate
            };
        }
        return milestone;
    };

    const header = (() => {
        if (formTab === 'add') return { name: newMilestoneData.name || "Draft Milestone", startDate: newMilestoneData.startDate, dueDate: newMilestoneData.dueDate };
        if (formTab === 'edit' && editingMilestoneId === activeMilestone?.milestoneId) return { name: newMilestoneData.name || activeMilestone?.name, startDate: newMilestoneData.startDate || activeMilestone?.startDate, dueDate: newMilestoneData.dueDate || activeMilestone?.dueDate };
        return { name: activeMilestone?.name || "No Milestone Selected", startDate: activeMilestone?.startDate, dueDate: activeMilestone?.dueDate };
    })();

    const cancelBtnLabel = viewMode === 'detail' ? "Back to List" : "Cancel";

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'hidden', position: 'relative' }}>
            {/* TOP BAR: Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {[
                    { label: 'Total', count: milestones.length, color: '#64748b', bg: '#f1f5f9', icon: <Activity size={16} /> },
                    { label: 'Active', count: milestones.filter(m => m.status === MilestoneStatus.InProgress).length, color: '#E8720C', bg: '#fff7ed', icon: <Clock size={16} /> },
                    { label: 'Completed', count: milestones.filter(m => m.status === MilestoneStatus.Completed).length, color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle2 size={16} /> }
                ].map((stat, i) => (
                    <div key={i} style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.6rem', boxShadow: '0 1px 4px rgba(0,0,0,0.01)' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: stat.bg, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{stat.icon}</div>
                        <div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{stat.count}</div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginTop: '3px' }}>{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'stretch', position: 'relative', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', flex: 1, minHeight: 0 }}>
                {/* LEFT COLUMN: Milestone List */}
                <div style={{ flex: viewMode === 'roadmap' ? 7 : 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem', opacity: viewMode === 'roadmap' ? 1 : 0, pointerEvents: viewMode === 'roadmap' ? 'auto' : 'none', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', width: viewMode === 'roadmap' ? 'auto' : 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '2px solid var(--primary-color)', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Target size={18} style={{ color: 'var(--primary-color)' }} />
                            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>Milestone List</h4>
                        </div>
                        {canManageMilestones && !isArchived && (
                            <button
                                onClick={handleSwitchToAdd}
                                title="Add New Milestone"
                                style={{ ...iconBtn, width: '28px', height: '28px', background: 'var(--primary-color)', color: 'white', borderRadius: '8px' }}
                            >
                                <Plus size={16} />
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', background: 'white', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input type="text" placeholder="Search..." value={milestoneSearchQuery} onChange={(e) => setMilestoneSearchQuery(e.target.value)} style={{ ...inputStyle, padding: '0.6rem 0.6rem 0.6rem 2.25rem', fontSize: '0.8rem' }} />
                        </div>
                        <select value={milestoneStatusFilter} onChange={(e) => setMilestoneStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.6rem 0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>
                            <option value="all">Filter</option>
                            <option value={MilestoneStatus.InProgress}>Active</option>
                            <option value={MilestoneStatus.Completed}>Done</option>
                        </select>
                    </div>
                    <div ref={milestoneContainerRef} style={{ maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }} className="custom-scrollbar">
                        {filteredMilestones.map((milestone, idx) => (
                            <MilestoneItem key={`ml-${milestone.milestoneId || idx}`} milestone={getLiveMilestoneItem(milestone)} onClick={protectedMilestoneClick} onDetailClick={onDetailClick} />
                        ))}
                    </div>
                </div>

                {/* FORM COLUMN */}
                {canManageMilestones && !isArchived && (
                    <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '0.8rem', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', minWidth: '310px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '0.5rem', borderBottom: '2px solid var(--primary-color)', width: 'fit-content' }}>
                            {formTab === 'add' ? <Plus size={16} /> : formTab === 'edit' ? <Edit3 size={16} /> : <Target size={16} />}
                            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>{formTab === 'add' ? 'New Milestone' : formTab === 'edit' ? 'Edit Milestone' : 'Milestone Detail'}</h4>
                        </div>
                        {viewMode === 'detail' && formTab !== 'add' && (
                            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <button onClick={() => setFormTab('view')} style={{ ...tabStyle, flex: 1, ...(formTab === 'view' ? activeTabStyle : inactiveTabStyle) }}>View</button>
                                <button onClick={handleSwitchToEdit} style={{ ...tabStyle, flex: 1, ...(formTab === 'edit' ? activeTabStyle : inactiveTabStyle) }}>Edit</button>
                            </div>
                        )}
                        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {formTab === 'view' && activeMilestone ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div><label style={labelStyle}>Name</label><div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{activeMilestone.name}</div></div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div><label style={labelStyle}>Start Date</label><div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{formatDate(activeMilestone.startDate)}</div></div>
                                        <div><label style={labelStyle}>Due Date</label><div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{formatDate(activeMilestone.dueDate)}</div></div>
                                    </div>
                                    <div><label style={labelStyle}>Goal</label><div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, background: '#f8fafc', padding: '0.85rem', borderRadius: '12px' }}>{activeMilestone.description || "No goal defined."}</div></div>
                                    <button onClick={protectedCancelEdit} style={{ ...btnSecondary, width: '100%', padding: '0.75rem' }}>{cancelBtnLabel}</button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}><label style={labelStyle}>Name</label><input type="text" placeholder="Enter name..." value={newMilestoneData.name} onChange={(e) => handleMilestoneDataChange('name', e.target.value)} style={{ ...inputStyle, padding: '0.75rem' }} /></div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                        <div><label style={labelStyle}>Start</label><input type="date" value={newMilestoneData.startDate} onChange={(e) => handleMilestoneDataChange('startDate', e.target.value)} style={{ ...inputStyle, padding: '0.65rem' }} /></div>
                                        <div><label style={labelStyle}>Due</label><input type="date" value={newMilestoneData.dueDate} onChange={(e) => handleMilestoneDataChange('dueDate', e.target.value)} style={{ ...inputStyle, padding: '0.65rem' }} /></div>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Goal</label>
                                        <textarea placeholder="Description..." value={newMilestoneData.description} onChange={(e) => handleMilestoneDataChange('description', e.target.value)} style={{ ...inputStyle, minHeight: '80px', padding: '0.75rem' }} />
                                    </div>

                                    {formTab === 'add' && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
                                            <button
                                                onClick={() => {
                                                    if (viewMode === 'roadmap') onDetailClick({ name: newMilestoneData.name || "New Milestone" } as any);
                                                    addDraftSlot();
                                                }}
                                                style={{
                                                    background: 'none', border: 'none', padding: 0,
                                                    color: 'var(--primary-color)', fontSize: '0.72rem', fontWeight: 800,
                                                    display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
                                                }}
                                            >
                                                Add Milestone Task <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                                        <button onClick={protectedCancelEdit} style={{ ...btnSecondary, flex: 1, padding: '0.75rem' }}>{cancelBtnLabel}</button>
                                        <button onClick={handleQuickMilestoneSave} disabled={!newMilestoneData.name} style={{ ...btnPrimary, flex: 1, padding: '0.75rem', opacity: !newMilestoneData.name ? 0.5 : 1 }}>Save Changes</button>
                                    </div>
                                </>
                            )}
                        </div>
                        {latestMilestoneDate && (
                            <div style={{ display: 'flex', gap: '8px', padding: '0.85rem 1rem', background: '#f0f9ff', borderRadius: '14px', border: '1px solid #e0f2fe' }}>
                                <Info size={16} style={{ color: '#0369a1', marginTop: '2px', flexShrink: 0 }} />
                                <div style={{ fontSize: '0.75rem', color: '#075985' }}>Last milestone ends on <strong>{formatDate(latestMilestoneDate)}</strong>.</div>
                            </div>
                        )}
                    </div>
                )}

                {/* TASK BOARD (Right Column) */}
                <div style={{ flex: viewMode === 'detail' ? 7 : 0, display: 'flex', flexDirection: 'column', gap: '1rem', opacity: viewMode === 'detail' ? 1 : 0, pointerEvents: viewMode === 'detail' ? 'auto' : 'none', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', width: viewMode === 'detail' ? 'auto' : 0, overflow: 'hidden', minHeight: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '0.5rem', borderBottom: '2px solid #6366f1' }}>
                        <Target size={18} style={{ color: '#6366f1' }} />
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>Milestone Tasks: {header.name}</h4>
                    </div>

                    <div style={{ flex: 1, background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.02)', minHeight: 0 }}>
                        <div style={{ padding: '0.6rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b' }}>
                                <Calendar size={14} /><span style={{ fontSize: '0.72rem', fontWeight: 750 }}>{header.startDate ? `${formatDate(header.startDate)} - ${formatDate(header.dueDate)}` : "TBD"}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {draftTasks.length > 0 && (
                                    <button onClick={handleBulkTaskSave} style={{ ...btnPrimary, padding: '6px 14px', fontSize: '0.75rem', background: '#10b981', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)', borderRadius: '10px' }}>
                                        <Save size={14} /> Save All ({draftTasks.length})
                                    </button>
                                )}
                                <button
                                    onClick={addDraftSlot}
                                    style={{ ...btnPrimary, padding: '7px 15px', fontSize: '0.75rem', borderRadius: '10px' }}
                                >
                                    <Plus size={14} /> New Task
                                </button>
                            </div>
                        </div>

                        <div
                            style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', maxHeight: '480px' }}
                            className="custom-scrollbar"
                        >
                            {draftTasks.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f97316', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Edit3 size={12} style={{ color: '#f97316' }} /> Planning Mode ({draftTasks.length} draft tasks)
                                    </div>
                                    {draftTasks.map((draft) => (
                                        <div
                                            key={draft.id}
                                            style={{
                                                background: 'white',
                                                padding: '12px 15px',
                                                borderRadius: '16px',
                                                border: '1.5px solid #fb923c', // Minimalist Orange Border
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: draft.isExpanded ? '15px' : '0',
                                                transition: 'all 0.2s ease',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.08)',
                                                animation: 'slideIn 0.2s ease-out'
                                            }}
                                            onClick={() => toggleDraftExpand(draft.id)}
                                        >
                                            {/* Header / Summary Row */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) 80px 140px 80px', gap: '10px', alignItems: 'center' }}>
                                                <div style={{ color: '#6366f1', display: 'flex', alignItems: 'center' }}>
                                                    {draft.isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                </div>

                                                <div style={{ position: 'relative', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {draft.isExpanded ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <FileText size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                                            <input
                                                                type="text" placeholder="Task name..." value={draft.name}
                                                                onChange={(e) => updateDraft(draft.id, 'name', e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{ ...compactInput, width: '100%', border: 'none', background: 'transparent', padding: '0', fontWeight: 700, fontSize: '0.85rem' }}
                                                                autoFocus
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 650, color: draft.name ? '#1e293b' : '#94a3b8' }}>
                                                            {draft.name || "Untitled Task"}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Priority Badge */}
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    {!draft.isExpanded && (
                                                        <div style={{
                                                            fontSize: '0.6rem',
                                                            fontWeight: 800,
                                                            padding: '2px 6px',
                                                            borderRadius: '6px',
                                                            textTransform: 'uppercase',
                                                            background: draft.priority === 4 ? '#fef2f2' : draft.priority === 3 ? '#fff7ed' : draft.priority === 2 ? '#f0f9ff' : '#f8fafc',
                                                            color: draft.priority === 4 ? '#991b1b' : draft.priority === 3 ? '#9a3412' : draft.priority === 2 ? '#0369a1' : '#64748b',
                                                            border: `1px solid ${draft.priority === 4 ? '#fee2e2' : draft.priority === 3 ? '#ffedd5' : draft.priority === 2 ? '#e0f2fe' : '#e2e8f0'}`
                                                        }}>
                                                            {draft.priority === 4 ? 'Crit' : draft.priority === 3 ? 'High' : draft.priority === 2 ? 'Med' : 'Low'}
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#64748b' }}>
                                                    {!draft.isExpanded && (
                                                        <>
                                                            <User size={12} />
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {(() => {
                                                                    const m = members.find(mem => (mem.id || mem.userId || mem.memberId) === draft.assigneeId);
                                                                    return m?.fullName || m?.userName || m?.user?.fullName || "No Assignee";
                                                                })()}
                                                            </span>
                                                            {draft.collaboratorIds.length > 0 && (
                                                                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 4px', borderRadius: '4px', fontSize: '0.6rem' }}>
                                                                    +{draft.collaboratorIds.length}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        disabled={draft.isSaving || !draft.name || !draft.assigneeId}
                                                        onClick={(e) => { e.stopPropagation(); handleSingleTaskSave(draft); }}
                                                        style={{ ...iconBtn, width: '28px', height: '28px', color: '#10b981', background: '#ecfdf5', opacity: (!draft.name || !draft.assigneeId) ? 0.4 : 1 }}
                                                    >
                                                        {draft.isSaving ? <Activity size={12} className="spin" /> : <Save size={12} />}
                                                    </button>
                                                    <button onClick={(e) => removeDraft(draft.id, e)} style={{ ...iconBtn, width: '28px', height: '28px', color: '#ef4444', background: '#fef2f2' }}><Trash2 size={12} /></button>
                                                </div>
                                            </div>

                                            {/* Detailed Section (Shown only when expanded) */}
                                            {draft.isExpanded && (
                                                <div
                                                    style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', animation: 'slideIn 0.2s ease-out' }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <textarea
                                                        placeholder="Quick notes or specific task requirements..." value={draft.description}
                                                        onChange={(e) => updateDraft(draft.id, 'description', e.target.value)}
                                                        style={{ ...inputStyle, minHeight: '54px', padding: '8px 12px', fontSize: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}
                                                    />

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                                                        {/* Priority & Dates Row */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ flex: 1, position: 'relative' }}>
                                                                <Calendar size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                                <input
                                                                    type="date" value={draft.startDate}
                                                                    onChange={(e) => updateDraft(draft.id, 'startDate', e.target.value)}
                                                                    style={{ ...compactInput, width: '100%', paddingLeft: '26px', fontSize: '0.65rem' }}
                                                                />
                                                            </div>
                                                            <span style={{ color: '#cbd5e1' }}>→</span>
                                                            <div style={{ flex: 1, position: 'relative' }}>
                                                                <Calendar size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                                <input
                                                                    type="date" min={draft.startDate} max={mDueDate} value={draft.dueDate}
                                                                    onChange={(e) => updateDraft(draft.id, 'dueDate', e.target.value)}
                                                                    style={{ ...compactInput, width: '100%', paddingLeft: '26px', fontSize: '0.65rem' }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div style={{ position: 'relative' }}>
                                                            <Target size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 1 }} />
                                                            <select
                                                                value={draft.priority}
                                                                onChange={(e) => updateDraft(draft.id, 'priority', parseInt(e.target.value))}
                                                                style={{ ...compactInput, width: '100%', paddingLeft: '26px', fontSize: '0.65rem' }}
                                                            >
                                                                <option value="1">Priority: Low</option>
                                                                <option value="2">Priority: Medium</option>
                                                                <option value="3">Priority: High</option>
                                                                <option value="4">Priority: Critical</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: '12px' }}>
                                                        {/* Team Row */}
                                                        <div style={{ position: 'relative' }}>
                                                            <User size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 10, pointerEvents: 'none' }} />
                                                            <select
                                                                value={draft.assigneeId}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    updateDraft(draft.id, 'assigneeId', val);
                                                                    updateDraft(draft.id, 'collaboratorIds', (draft.collaboratorIds || []).filter(id => id !== val));
                                                                }}
                                                                style={{ ...compactInput, width: '100%', paddingLeft: '26px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                            >
                                                                <option value="">Select Assignee</option>
                                                                {members.filter(m => Number(m.projectRole) !== 1).map(m => {
                                                                    const mId = m.id || m.userId || m.memberId || "";
                                                                    const mName = m.fullName || m.userName || m.user?.fullName || "Member";
                                                                    return <option key={mId} value={mId}>{mName}</option>;
                                                                })}
                                                            </select>
                                                        </div>

                                                        <div style={{ position: 'relative' }}>
                                                            <UserPlus size={12} style={{ position: 'absolute', left: '8px', top: '10px', color: '#94a3b8', zIndex: 10, pointerEvents: 'none' }} />
                                                            <div
                                                                style={{ padding: '4px 4px 4px 26px', background: 'white', borderRadius: '10px', border: '1.5px solid #e2e8f0', minHeight: '36px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}
                                                            >
                                                                {(draft.collaboratorIds || []).map(cid => {
                                                                    const m = members.find(mem => (mem.id || mem.userId || mem.memberId) === cid);
                                                                    return (
                                                                        <div key={cid} style={{ background: '#f1f5f9', color: '#1e293b', padding: '1px 8px', borderRadius: '6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #e2e8f0', height: '24px', fontWeight: 600 }}>
                                                                            {m?.fullName || m?.userName || m?.user?.fullName || "..."}
                                                                            <X size={10} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => { updateDraft(draft.id, 'collaboratorIds', draft.collaboratorIds.filter(id => id !== cid)); }} />
                                                                        </div>
                                                                    );
                                                                })}
                                                                <select
                                                                    value=""
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        if (val && !draft.collaboratorIds.includes(val) && val !== draft.assigneeId) {
                                                                            updateDraft(draft.id, 'collaboratorIds', [...(draft.collaboratorIds || []), val]);
                                                                        }
                                                                    }}
                                                                    style={{ border: 'none', background: 'transparent', fontSize: '0.7rem', outline: 'none', color: '#1e293b', flex: 1, minWidth: '100px', cursor: 'pointer', height: '100%', fontWeight: 600 }}
                                                                >
                                                                    <option value="">+ Add Collabs</option>
                                                                    {members.filter(m => {
                                                                        const id = m.id || m.userId || m.memberId || "";
                                                                        return Number(m.projectRole) !== 1 && id !== draft.assigneeId;
                                                                    }).map(m => {
                                                                        const mId = m.id || m.userId || m.memberId || "";
                                                                        const mName = m.fullName || m.userName || m.user?.fullName || "Member";
                                                                        return <option key={mId} value={mId} disabled={draft.collaboratorIds.includes(mId)}>{mName}</option>;
                                                                    })}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                                    <Target size={32} style={{ color: '#cbd5e1', marginBottom: '1.5rem' }} />
                                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1rem', fontWeight: 800 }}>{formTab === 'add' ? 'Drafting Mode' : 'Ready for Expansion'}</h5>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{formTab === 'add' ? 'Add tasks below or click "New Task" above to start planning for this draft.' : 'No tasks assigned yet. Click "New Task" to start planning.'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* MINIMALIST CONFIRMATION MODAL */}
            {confirmState.isOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(255, 255, 255, 0.3)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'white',
                        padding: '1.25rem',
                        borderRadius: '20px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.12)',
                        border: '1px solid #e2e8f0',
                        maxWidth: '260px',
                        width: '90%',
                        textAlign: 'center',
                        animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={20} />
                            </div>
                        </div>
                        <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Discard Changes?</div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>{confirmState.message}</p>
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <button
                                onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                                style={{ ...btnSecondary, flex: 1, padding: '0.6rem', fontSize: '0.75rem', borderRadius: '10px' }}
                            >
                                Stay
                            </button>
                            <button
                                onClick={() => {
                                    confirmState.onConfirm();
                                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                                }}
                                style={{ ...btnPrimary, flex: 1, padding: '0.6rem', fontSize: '0.75rem', background: '#e11d48', borderRadius: '10px' }}
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes popIn { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                .spin { animation: rotation 1.5s infinite linear; }
                @keyframes rotation { from { transform: rotate(0deg); } to { transform: rotate(359deg); } }
            `}</style>
        </div>
    );
};

// Styles
const labelStyle: React.CSSProperties = { fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' };
const inputStyle: React.CSSProperties = { width: '100%', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' };
const compactInput: React.CSSProperties = { border: '1.5px solid #e2e8f0', background: 'white', borderRadius: '10px', height: '36px', fontSize: '0.75rem', outline: 'none', padding: '0 10px', transition: 'border-color 0.2s' };
const tabStyle: React.CSSProperties = { padding: '8px 12px', fontSize: '0.7rem', fontWeight: 800, border: 'none', borderRadius: '8px', cursor: 'pointer' };
const activeTabStyle: React.CSSProperties = { background: 'white', color: 'var(--primary-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' };
const inactiveTabStyle: React.CSSProperties = { background: 'transparent', color: '#64748b' };
const btnPrimary: React.CSSProperties = { background: 'var(--primary-color)', color: 'white', border: 'none', fontWeight: 800, borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const btnSecondary: React.CSSProperties = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 800, borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const iconBtn: React.CSSProperties = { width: '32px', height: '32px', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' };

export default DetailsMilestones;
