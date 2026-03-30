import React, { useState, useEffect } from 'react';
import { 
    X, 
    Briefcase,
    Zap,
    Edit3,
    Save,
    Send,
    Trash2,
    Loader2,
    RefreshCw,
    Search,
    Plus,
    Check
} from 'lucide-react';
import reportService, { Report } from '@/services/reportService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { milestoneService } from '@/services/milestoneService';
import Toast, { ToastType } from '@/components/common/Toast';
import { useAuth } from '@/hooks/useAuth';

interface ReportPanelProps {
    reportId: string | null;
    isAdding: boolean;
    onClose: () => void;
    onSaved: () => void;
}

const ReportPanel: React.FC<ReportPanelProps> = ({ 
    reportId, 
    isAdding, 
    onClose, 
    onSaved 
}) => {
    const { user } = useAuth();
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(isAdding);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Metadata
    const [projects, setProjects] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [milestones, setMilestones] = useState<any[]>([]);
    
    // UI Modals
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
    const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // Form data
    const initialFormData = {
        projectId: '',
        milestoneId: '',
        title: '',
        description: '',
        goals: '',
        achievements: '',
        blockers: '',
        nextWeek: '',
        assigneeEmails: [] as string[],
        status: 0
    };

    const [formData, setFormData] = useState(initialFormData);

    const isLabDirector = React.useMemo(() => {
        const role = Number(user?.role);
        return role === 1 || role === 2;
    }, [user?.role]);

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const [pData, uData] = await Promise.all([
                    projectService.getAll(),
                    userService.getAll()
                ]);
                setProjects(pData || []);
                setAllUsers(uData || []);
            } catch (err) {
                console.error("Failed to load metadata", err);
            }
        };
        fetchMeta();
    }, []);

    useEffect(() => {
        if (reportId && !isAdding) {
            fetchReport(reportId);
        } else if (isAdding) {
            setReport(null);
            setFormData(initialFormData);
            setIsEditMode(true);
        }
    }, [reportId, isAdding]);

    const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

    useEffect(() => {
        if (formData.projectId && formData.projectId !== EMPTY_GUID) {
            fetchMilestones(formData.projectId);
        } else {
            setMilestones([]);
        }
    }, [formData.projectId]);

    const fetchMilestones = async (projectId: string) => {
        try {
            const data = await milestoneService.getByProject(projectId);
            setMilestones(data || []);
        } catch (err) {
            console.error("Failed to load milestones", err);
        }
    };

    const fetchReport = async (id: string) => {
        setLoading(true);
        try {
            const data = await reportService.getReportById(id);
            const reportData = data?.data || data;
            setReport(reportData);
            setFormData({
                projectId: reportData.projectId || reportData.ProjectId || '',
                milestoneId: reportData.milestoneId || reportData.MilestoneId || '',
                title: reportData.title || reportData.Title || '',
                description: reportData.description || reportData.Description || '',
                goals: reportData.goals || reportData.Goals || '',
                achievements: reportData.achievements || reportData.Achievements || '',
                blockers: reportData.blockers || reportData.Blockers || '',
                nextWeek: reportData.nextWeek || reportData.NextWeek || '',
                assigneeEmails: (() => {
                    const r = reportData as any;
                    const members = r.assignees || r.Assignees || r.members || r.Members;
                    if (members && Array.isArray(members)) {
                        return members.map((a: any) => a.email || a.Email || '').filter(e => e !== '');
                    }
                    return r.assigneeEmails || r.AssigneeEmails || [];
                })(),
                status: reportData.status ?? reportData.Status ?? 0
            });
            setIsEditMode(false);
        } catch (error) {
            console.error('Failed to fetch report:', error);
            showToast('Failed to load report details.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: ToastType = 'info') => {
        setToast({ message, type });
    };

    const handleSave = async (isSubmission: boolean = false) => {
        if (!formData.title.trim()) return showToast("Title is required.", "error");
        if (formData.assigneeEmails.length === 0) return showToast("At least one reviewer is required.", "error");

        if (isSubmission) {
            if (!formData.projectId) return showToast("Project is required for submission.", "error");
            if (!formData.milestoneId) return showToast("Milestone is required for submission.", "error");
        }

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                projectId: formData.projectId || null,
                milestoneId: formData.milestoneId || null,
                userId: user?.userId,
                status: isSubmission ? 1 : formData.status
            };

            if (isAdding) {
                const newReport = await reportService.createReport(payload);
                if (isSubmission) {
                    await reportService.updateReportStatus(newReport.id, 1);
                    showToast('Report submitted correctly.', 'success');
                } else {
                    showToast('Report created successfully!', 'success');
                }
            } else if (reportId) {
                await reportService.updateReport(reportId, payload);
                if (isSubmission) {
                    await reportService.updateReportStatus(reportId, 1);
                    showToast('Report submitted correctly.', 'success');
                } else {
                    showToast('Report updated successfully!', 'success');
                }
            }
            
            onSaved();
            if (isAdding) onClose();
            else fetchReport(reportId || '');
        } catch (error: any) {
            console.error('Save error:', error);
            showToast(error.response?.data?.message || 'Failed to save report.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusUpdate = async (newStatus: number) => {
        if (!reportId) return;
        setSubmitting(true);
        try {
            await reportService.updateReportStatus(reportId, newStatus);
            showToast(`Status updated successfully.`, 'success');
            fetchReport(reportId);
            onSaved();
        } catch (error) {
            showToast('Failed to update status.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!reportId || !window.confirm("Are you sure you want to delete this report?")) return;
        setSubmitting(true);
        try {
            await reportService.deleteReport(reportId);
            showToast('Report deleted.', 'success');
            onSaved();
            onClose();
        } catch (error) {
            showToast('Failed to delete report.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleIndexing = async () => {
        if (!reportId) return;
        setSubmitting(true);
        try {
            await reportService.ensureEmbedding(reportId);
            showToast('AI Indexing started.', 'success');
            fetchReport(reportId);
        } catch (error) {
            showToast('Indexing failed.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--text-muted)' }}>
                <Loader2 className="animate-spin" size={40} />
                <p>Retrieving research data...</p>
            </div>
        );
    }

    const filteredUsers = allUsers.filter(u => 
        u.fullName?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
        u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
    );

    const getStatusInfo = (status: number) => {
        switch (status) {
            case 0: return { label: 'Draft', color: '#64748b', bg: '#f8fafc' };
            case 1: return { label: 'Submitted', color: '#0ea5e9', bg: '#f0f9ff' };
            case 2: return { label: 'Approved', color: '#10b981', bg: '#f0fdf4' };
            case 3: return { label: 'Revision', color: '#f59e0b', bg: '#fffbeb' };
            default: return { label: 'Unknown', color: '#94a3b8', bg: '#f1f5f9' };
        }
    };

    const statusInfo = getStatusInfo(formData.status);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fcfdfe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-color)15', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                            {isAdding ? 'Create New Report' : isEditMode ? 'Edit Report' : 'Report Details'}
                        </h2>
                        {!isAdding && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID: {reportId?.substring(0, 8)}</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', color: '#64748b', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Status, Project & Milestone Context */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                            <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Status</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: statusInfo.color }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusInfo.color }}></div>
                                <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>{statusInfo.label}</span>
                            </div>
                        </div>
                        <div 
                            onClick={() => isEditMode && setIsProjectModalOpen(true)}
                            style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: isEditMode ? '#fff' : '#f8fafc', border: isEditMode ? '2px dashed var(--primary-color)33' : '1px solid #f1f5f9', cursor: isEditMode ? 'pointer' : 'default' }}
                        >
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
                                Project <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <Briefcase size={14} color="var(--primary-color)" />
                                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {(() => {
                                        const p = projects.find(proj => proj.projectId === formData.projectId);
                                        return p?.projectName || p?.name || 'Select Project';
                                    })()}
                                </span>
                            </div>
                        </div>
                        <div 
                            onClick={() => isEditMode && formData.projectId && setIsMilestoneModalOpen(true)}
                            style={{ 
                                padding: '0.75rem 1rem', borderRadius: '12px', 
                                background: isEditMode ? (formData.projectId ? '#fff' : '#f1f5f9') : '#f8fafc', 
                                border: isEditMode ? '2px dashed var(--primary-color)33' : '1px solid #f1f5f9', 
                                cursor: (isEditMode && formData.projectId) ? 'pointer' : 'default',
                                opacity: (isEditMode && !formData.projectId) ? 0.6 : 1
                            }}
                        >
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
                                Milestone <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <Zap size={14} color="#f59e0b" />
                                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {(() => {
                                        const m = milestones.find(ms => (ms.milestoneId || ms.id) === formData.milestoneId);
                                        return m?.title || m?.name || 'Select Milestone';
                                    })()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                Report Title <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            {isEditMode && <span style={{ fontSize: '0.6rem', color: formData.title.length >= 200 ? '#ef4444' : '#94a3b8', fontWeight: 700 }}>{formData.title.length}/200</span>}
                        </div>
                        {isEditMode ? (
                            <input 
                                className="form-input" 
                                value={formData.title} 
                                onChange={e => setFormData({...formData, title: e.target.value})}
                                maxLength={200}
                                placeholder="Enter a concise title..."
                                style={{ fontSize: '1rem', fontWeight: 700, padding: '12px', borderRadius: '10px' }}
                            />
                        ) : (
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>{formData.title}</h3>
                        )}
                    </div>

                    {/* Content Sections */}
                    {[
                        { label: 'Description', key: 'description' as const, required: true },
                        { label: 'Strategic Goals', key: 'goals' as const, required: true },
                        { label: 'Key Achievements', key: 'achievements' as const, required: true },
                        { label: 'Current Blockers', key: 'blockers' as const, required: true },
                        { label: 'Future Plans', key: 'nextWeek' as const, required: true }
                    ].map(section => (
                        <div key={section.key}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                    {section.label} {section.required && <span style={{ color: '#ef4444' }}>*</span>}
                                </label>
                                {isEditMode && <span style={{ fontSize: '0.6rem', color: formData[section.key].length >= 2000 ? '#ef4444' : '#94a3b8', fontWeight: 700 }}>{formData[section.key].length}/2000</span>}
                            </div>
                            {isEditMode ? (
                                <textarea 
                                    className="form-input"
                                    value={formData[section.key]}
                                    onChange={e => setFormData({...formData, [section.key]: e.target.value})}
                                    maxLength={2000}
                                    style={{ minHeight: '100px', fontSize: '0.9rem', padding: '12px', borderRadius: '10px', background: '#fcfdfe' }}
                                />
                            ) : (
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                    {formData[section.key] || `No ${section.label.toLowerCase()} provided.`}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* Reviewers List */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                Reviewers <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            {isEditMode && (
                                <button onClick={() => setIsAssigneeModalOpen(true)} style={{ border: 'none', background: 'none', color: 'var(--primary-color)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Plus size={12} /> Manage
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {formData.assigneeEmails.map(email => {
                                const u = allUsers.find(user => user.email === email);
                                return (
                                    <div key={email} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 600 }}>
                                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem' }}>{u?.fullName?.[0] || 'U'}</div>
                                        {u?.fullName || email}
                                    </div>
                                );
                            })}
                            {formData.assigneeEmails.length === 0 && <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No reviewers assigned.</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Actions Footer */}
            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9', background: '#fcfdfe', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {!isAdding && !isEditMode && formData.status === 0 && (
                        <button onClick={handleDelete} className="btn btn-secondary" style={{ color: '#ef4444', padding: '0 12px' }}>
                            <Trash2 size={16} />
                        </button>
                    )}
                    {!isAdding && !isEditMode && formData.status === 2 && (
                       <button 
                            onClick={handleIndexing} 
                            disabled={submitting || (report as any)?.hasEmbedding}
                            className="btn btn-secondary" 
                            style={{ gap: '6px', fontSize: '0.8rem' }}
                        >
                            {(report as any)?.hasEmbedding ? <Check size={14} /> : <RefreshCw size={14} className={submitting ? 'animate-spin' : ''} />}
                            {(report as any)?.hasEmbedding ? 'AI Indexed' : 'Start Indexing'}
                       </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {isEditMode ? (
                        <>
                            <button onClick={isAdding ? onClose : () => setIsEditMode(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={() => handleSave(false)} disabled={submitting} className="btn btn-secondary" style={{ gap: '8px' }}>
                                <Save size={16} /> {isAdding ? 'Save Draft' : 'Update'}
                            </button>
                            <button onClick={() => handleSave(true)} disabled={submitting} className="btn btn-primary" style={{ gap: '8px' }}>
                                <Send size={16} /> Submit
                            </button>
                        </>
                    ) : (
                        <>
                            {!isAdding && formData.status === 0 && (
                                <button 
                                    onClick={() => handleSave(true)} 
                                    className="btn btn-primary" 
                                    style={{ gap: '8px', fontWeight: 600 }}
                                >
                                    <Send size={16} /> Submit
                                </button>
                            )}
                            {!isAdding && formData.status === 0 && (
                                <button onClick={() => setIsEditMode(true)} className="btn btn-secondary" style={{ gap: '8px' }}>
                                    <Edit3 size={16} /> Edit
                                </button>
                            )}
                            {(formData.status === 1) && isLabDirector && (
                                <>
                                    <button onClick={() => handleStatusUpdate(3)} disabled={submitting} className="btn btn-secondary" style={{ color: '#f59e0b' }}>Request Revision</button>
                                    <button onClick={() => handleStatusUpdate(2)} disabled={submitting} className="btn btn-primary" style={{ background: '#10b981' }}>Approve Report</button>
                                </>
                            )}
                            {formData.status === 2 && isLabDirector && (
                                <button onClick={() => handleStatusUpdate(0)} disabled={submitting} className="btn btn-secondary">Revert to Draft</button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Selection Modals */}
            {isProjectModalOpen && (
                <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                    onClick={() => setIsProjectModalOpen(false)}
                >
                    <div 
                        style={{ width: '100%', maxWidth: '400px', maxHeight: '80vh', background: 'white', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>Select Project</h3>
                            <button onClick={() => setIsProjectModalOpen(false)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: '1rem', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {projects.map(p => (
                                    <div 
                                        key={p.projectId} 
                                        onClick={() => { setFormData({...formData, projectId: p.projectId, milestoneId: ''}); }}
                                        style={{ padding: '12px 16px', borderRadius: '12px', background: formData.projectId === p.projectId ? 'var(--primary-color)10' : '#f8fafc', cursor: 'pointer', border: formData.projectId === p.projectId ? '1px solid var(--primary-color)30' : '1px solid #e2e8f0', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                    >
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: formData.projectId === p.projectId ? 'var(--primary-color)' : '#1e293b' }}>{p.projectName || p.name || 'Untitled Project'}</span>
                                        {formData.projectId === p.projectId && <Check size={18} color="var(--primary-color)" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9' }}>
                            <button onClick={() => setIsProjectModalOpen(false)} className="btn btn-primary" style={{ width: '100%', height: '44px', borderRadius: '12px', fontWeight: 700 }}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {isMilestoneModalOpen && (
                <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                    onClick={() => setIsMilestoneModalOpen(false)}
                >
                    <div 
                        style={{ width: '100%', maxWidth: '400px', maxHeight: '80vh', background: 'white', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>Select Milestone</h3>
                            <button onClick={() => setIsMilestoneModalOpen(false)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: '1rem', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {milestones.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No milestones found for this project.</div>
                                ) : milestones.map(m => (
                                    <div 
                                        key={m.milestoneId || m.id} 
                                        onClick={() => { setFormData({...formData, milestoneId: m.milestoneId || m.id}); }}
                                        style={{ padding: '12px 16px', borderRadius: '12px', background: (formData.milestoneId === m.milestoneId || formData.milestoneId === m.id) ? 'var(--primary-color)10' : '#f8fafc', cursor: 'pointer', border: (formData.milestoneId === m.milestoneId || formData.milestoneId === m.id) ? '1px solid var(--primary-color)30' : '1px solid #e2e8f0', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                    >
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: (formData.milestoneId === m.milestoneId || formData.milestoneId === m.id) ? 'var(--primary-color)' : '#1e293b' }}>{m.title || m.name}</span>
                                        {(formData.milestoneId === m.milestoneId || formData.milestoneId === m.id) && <Check size={18} color="var(--primary-color)" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9' }}>
                            <button onClick={() => setIsMilestoneModalOpen(false)} className="btn btn-primary" style={{ width: '100%', height: '44px', borderRadius: '12px', fontWeight: 700 }}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {isAssigneeModalOpen && (
                <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                    onClick={() => setIsAssigneeModalOpen(false)}
                >
                    <div 
                        style={{ width: '100%', maxWidth: '500px', maxHeight: '85vh', background: 'white', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>Manage Reviewers</h3>
                            <button onClick={() => setIsAssigneeModalOpen(false)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: '1rem 1.75rem', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input 
                                    className="form-input" 
                                    placeholder="Find researchers..." 
                                    style={{ paddingLeft: '36px', height: '44px', borderRadius: '12px' }}
                                    value={userSearchQuery}
                                    onChange={e => setUserSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', padding: '1.25rem 1.75rem' }} className="custom-scrollbar">
                            {filteredUsers.map(u => {
                                const isSelected = formData.assigneeEmails.includes(u.email);
                                return (
                                    <div 
                                        key={u.userId}
                                        onClick={() => {
                                            const emails = isSelected ? formData.assigneeEmails.filter(e => e !== u.email) : [...formData.assigneeEmails, u.email];
                                            setFormData({...formData, assigneeEmails: emails});
                                        }}
                                        style={{ padding: '10px 14px', borderRadius: '12px', background: isSelected ? 'var(--primary-color)10' : '#fff', cursor: 'pointer', border: isSelected ? '1px solid var(--primary-color)50' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isSelected ? 'var(--primary-color)20' : '#f1f5f9', color: isSelected ? 'var(--primary-color)' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800 }}>{u.fullName?.[0]}</div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? 'var(--primary-color)' : '#1e293b' }}>{u.fullName}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                                            </div>
                                        </div>
                                        {isSelected && <Check size={18} color="var(--primary-color)" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ padding: '1.25rem 1.75rem', borderTop: '1px solid #f1f5f9' }}>
                            <button onClick={() => setIsAssigneeModalOpen(false)} className="btn btn-primary" style={{ width: '100%', height: '48px', borderRadius: '12px', fontWeight: 700 }}>Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportPanel;
