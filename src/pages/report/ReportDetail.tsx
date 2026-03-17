import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { 
    ArrowLeft, 
    X, 
    CheckCircle, 
    AlertTriangle, 
    ChevronRight,
    Briefcase,
    Zap,
    Eye,
    Edit3,
    Save,
    Send,
    Trash2,
    Sparkles,
    Loader2,
    RefreshCw
} from 'lucide-react';
import reportService, { Report } from '@/services/reportService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { milestoneService } from '@/services/milestoneService';
import Toast, { ToastType } from '@/components/common/Toast';

const ReportDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Metadata
    const [projects, setProjects] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [milestones, setMilestones] = useState<any[]>([]);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
    const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<number | null>(null);

    // Edit states
    const [editData, setEditData] = useState({
        projectId: '',
        milestoneId: '',
        title: '',
        description: '',
        goals: '',
        achievements: '',
        blockers: '',
        nextWeek: '',
        assigneeIds: [] as string[],
        status: 0
    });

    const isAssignee = React.useMemo(() => {
        if (!report || !user) return false;
        
        // 1. Role-based check (Admins and Lab Directors should see these)
        const role = Number(user.role);
        if (role === 1 || role === 2) return true;

        // 2. Assignee-based check (Case-insensitive for API variations)
        const assigneeIds = (report as any).assigneeIds || (report as any).AssigneeIds || [];
        const assignees = (report as any).assignees || (report as any).Assignees || [];
        
        // Check in ID array
        if (assigneeIds.includes(user.userId)) return true;
        
        // Check in object array
        if (assignees.some((a: any) => (a.id || a.userId || a.UserId) === user.userId)) return true;

        return false;
    }, [report, user]);

    useEffect(() => {
        if (id) {
            fetchReport();
        }
    }, [id]);

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
        if (editData.projectId) {
            fetchMilestones(editData.projectId);
        } else {
            setMilestones([]);
        }
    }, [editData.projectId]);

    const fetchMilestones = async (projectId: string) => {
        try {
            const data = await milestoneService.getByProject(projectId);
            setMilestones(data || []);
        } catch (err) {
            console.error("Failed to load milestones", err);
        }
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            const data = await reportService.getReportById(id!);
            const reportData = data?.data || data;
            setReport(reportData);
            setEditData({
                projectId: reportData.projectId || '',
                milestoneId: reportData.milestoneId || '',
                title: reportData.title || '',
                description: reportData.description || '',
                goals: reportData.goals || '',
                achievements: reportData.achievements || '',
                blockers: reportData.blockers || '',
                nextWeek: reportData.nextWeek || '',
                assigneeIds: reportData.assignees?.map((a: any) => a.id) || reportData.assigneeIds || [],
                status: reportData.status ?? 0
            });
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

    const handleUpdate = async () => {
        if (!id) return;
        setSubmitting(true);
        try {
            const payload = {
                ...editData,
                projectId: editData.projectId || null,
                milestoneId: editData.milestoneId || null,
            };

            await reportService.updateReport(id, payload);
            showToast('Report updated successfully!', 'success');
            setIsEditMode(false);
            fetchReport();
        } catch (error: any) {
            console.error('Failed to update report:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to update report.';
            showToast(errorMsg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFinalSubmit = () => {
        setIsSubmitModalOpen(true);
    };

    const confirmFinalSubmit = async () => {
        if (!id || !report) return;
        setIsSubmitModalOpen(false);
        setSubmitting(true);
        try {
            await reportService.updateReportStatus(id, 1);
            showToast('Report submitted correctly.', 'success');
            setIsEditMode(false);
            fetchReport();
        } catch (error) {
            console.error('Failed to submit report:', error);
            showToast('Submission failed.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEmbedding = async () => {
        if (!id) return;
        setSubmitting(true);
        try {
            await reportService.ensureEmbedding(id);
            showToast('AI Indexing started successfully.', 'success');
            fetchReport(); // Refresh to update hasEmbedding status
        } catch (error: any) {
            console.error('Failed to start indexing:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to start indexing.';
            showToast(errorMsg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevertToDraft = async () => {
        if (!id || !report) return;
        setSubmitting(true);
        try {
            await reportService.updateReportStatus(id, 0); // Draft state
            showToast('Report reverted to draft status.', 'success');
            fetchReport();
        } catch (error: any) {
            console.error('Failed to revert report:', error);
            showToast('Failed to revert status.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusUpdate = (status: number) => {
        setPendingStatus(status);
        setIsStatusModalOpen(true);
    };

    const confirmStatusUpdate = async () => {
        if (!id || pendingStatus === null) return;
        setIsStatusModalOpen(false);
        setSubmitting(true);
        try {
            await reportService.updateReportStatus(id, pendingStatus);
            const statusName = pendingStatus === 2 ? 'Approved' : 'Rejected';
            showToast(`Report ${statusName.toLowerCase()} successfully.`, 'success');
            fetchReport();
        } catch (error: any) {
            console.error('Failed to update status:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to update status.';
            showToast(errorMsg, 'error');
        } finally {
            setSubmitting(false);
            setPendingStatus(null);
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        setSubmitting(true);
        try {
            await reportService.deleteReport(id);
            showToast('Report deleted successfully.', 'success');
            setTimeout(() => navigate('/reports'), 1000);
        } catch (error) {
            console.error('Failed to delete report:', error);
            showToast('Delete failed.', 'error');
        } finally {
            setSubmitting(false);
            setIsDeleteModalOpen(false);
        }
    };

    const getStatusLabel = (status: number) => {
        switch (status) {
            case 0: return { label: 'Draft', color: '#64748b' };
            case 1: return { label: 'Submitted', color: '#0ea5e9' };
            case 2: return { label: 'Approved', color: '#10b981' };
            case 3: return { label: 'Rejected', color: '#ef4444' };
            default: return { label: 'Unknown', color: '#94a3b8' };
        }
    };

    if (loading) {
        return (
            <MainLayout role={user.role} userName={user.name}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                    <div className="spinner"></div>
                </div>
            </MainLayout>
        );
    }

    if (!report) {
        return (
            <MainLayout role={user.role} userName={user.name}>
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <AlertTriangle size={48} color="var(--error-color)" style={{ marginBottom: '1rem' }} />
                    <h2>Report not found</h2>
                    <button className="btn btn-primary" onClick={() => navigate('/reports')}>Back to Reports</button>
                </div>
            </MainLayout>
        );
    }

    const statusInfo = getStatusLabel(report.status);
    const canEdit = report.status === 0;

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem' }}>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {/* Header Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <button 
                        onClick={() => navigate('/reports')} 
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}
                    >
                        <ArrowLeft size={20} /> Back to reports
                    </button>

                    {canEdit && (
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                            <button 
                                onClick={() => setIsEditMode(false)}
                                style={{
                                    padding: '6px 16px', borderRadius: '7px', border: 'none',
                                    background: !isEditMode ? 'white' : 'transparent',
                                    color: !isEditMode ? 'var(--primary-color)' : 'var(--text-secondary)',
                                    fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                    boxShadow: !isEditMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s'
                                }}
                            >
                                <Eye size={16} /> View
                            </button>
                            <button 
                                onClick={() => setIsEditMode(true)}
                                style={{
                                    padding: '6px 16px', borderRadius: '7px', border: 'none',
                                    background: isEditMode ? 'white' : 'transparent',
                                    color: isEditMode ? 'var(--primary-color)' : 'var(--text-secondary)',
                                    fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                    boxShadow: isEditMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s'
                                }}
                            >
                                <Edit3 size={16} /> Edit
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Status Label (Minimal) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: statusInfo.color }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusInfo.color }}></span>
                            {statusInfo.label.toUpperCase()}
                        </div>

                        {/* Content Area */}
                        <div className="card" style={{ padding: '2.5rem', borderRadius: '12px' }}>
                            {isEditMode ? (
                                <div style={{ marginBottom: '2.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Report Title</label>
                                    <input 
                                        className="form-input" 
                                        style={{ fontSize: '1.5rem', fontWeight: 700, width: '100%', border: 'none', borderBottom: '1px solid #e2e8f0', borderRadius: 0, padding: '4px 0', outline: 'none' }}
                                        value={editData.title}
                                        onChange={(e) => setEditData({...editData, title: e.target.value})}
                                    />
                                </div>
                            ) : (
                                <h1 style={{ margin: '0 0 2.5rem 0', fontSize: '1.75rem', fontWeight: 700 }}>{report.title}</h1>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                                {[
                                    { label: 'Description', key: 'description' },
                                    { label: 'Strategic Goals', key: 'goals' },
                                    { label: 'Key Achievements', key: 'achievements' },
                                    { label: 'Current Blockers', key: 'blockers' },
                                    { label: 'Future Plans', key: 'nextWeek' }
                                ].map((section) => (
                                    <section key={section.key}>
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                            {section.label}
                                        </h3>
                                        {isEditMode ? (
                                            <textarea 
                                                className="form-input" 
                                                style={{ minHeight: '150px', width: '100%', lineHeight: 1.6, fontSize: '0.95rem' }}
                                                value={(editData as any)[section.key]}
                                                onChange={(e) => setEditData({...editData, [section.key]: e.target.value})}
                                            />
                                        ) : (
                                            <p style={{ lineHeight: 1.8, color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                {(report as any)[section.key] || `No ${section.label.toLowerCase()} provided.`}
                                            </p>
                                        )}
                                    </section>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Metadata - Position Sticky with header offset */}
                    <div style={{ position: 'sticky', top: '5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="card" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                            <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Report Info</h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Project</label>
                                    {isEditMode ? (
                                        <button onClick={() => setIsProjectModalOpen(true)} style={{ width: '100%', textAlign: 'left', border: '1px solid #e2e8f0', background: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Briefcase size={16} />
                                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>
                                                {projects.find(p => p.id === editData.projectId)?.name || projects.find(p => p.id === editData.projectId)?.projectName || 'Select Project'}
                                            </span>
                                            <ChevronRight size={14} />
                                        </button>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                                            <Briefcase size={16} /> {projects.find(p => p.id === report.projectId)?.name || projects.find(p => p.id === report.projectId)?.projectName || 'General'}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Milestone</label>
                                    {isEditMode ? (
                                        <button onClick={() => { if (!editData.projectId) return; setIsMilestoneModalOpen(true); }} style={{ width: '100%', textAlign: 'left', border: '1px solid #e2e8f0', background: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: editData.projectId ? 1 : 0.5 }}>
                                            <Zap size={16} />
                                            <span style={{ flex: 1, fontSize: '0.85rem' }}>{milestones.find(m => m.id === editData.milestoneId)?.name || 'Select Milestone'}</span>
                                            <ChevronRight size={14} />
                                        </button>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                                            <Zap size={16} /> {milestones.find(m => m.id === report.milestoneId)?.name || 'Unassigned'}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Assignees</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(isEditMode ? editData.assigneeIds : (report.assignees?.map(a => a.id) || [])).map(id => {
                                            const u = allUsers.find(user => user.id === id);
                                            return u ? (
                                                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px' }}>
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                        {u.fullName?.charAt(0) || u.name?.charAt(0)}
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem' }}>{u.fullName || u.name}</span>
                                                </div>
                                            ) : null;
                                        })}
                                        {isEditMode && (
                                            <button onClick={() => setIsAssigneeModalOpen(true)} style={{ border: '1px dashed #cbd5e1', background: 'none', padding: '6px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                                                Manage members
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span>Submitted</span>
                                        <span>{report.submitedAt ? new Date(report.submitedAt).toLocaleDateString() : 'Draft'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span>Last Updated</span>
                                        <span>{report.updateAt ? new Date(report.updateAt).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', alignItems: 'center' }}>
                                        <span>AI Status</span>
                                        <span style={{ 
                                            padding: '2px 8px', 
                                            borderRadius: '4px', 
                                            backgroundColor: (report.hasEmbedding || (report as any).HasEmbedding) ? '#f0fdf4' : '#f8fafc',
                                            color: (report.hasEmbedding || (report as any).HasEmbedding) ? '#166534' : '#64748b',
                                            fontWeight: 600,
                                            fontSize: '0.7rem',
                                            border: `1px solid ${(report.hasEmbedding || (report as any).HasEmbedding) ? '#bbf7d0' : '#e2e8f0'}`
                                        }}>
                                            {(report.hasEmbedding || (report as any).HasEmbedding) ? 'INDEXED' : 'NOT INDEXED'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons in Sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {isEditMode ? (
                                <button 
                                    className="btn btn-primary" 
                                    onClick={handleUpdate} 
                                    disabled={submitting}
                                    style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600 }}
                                >
                                    {submitting ? <Loader2 size={18} className="spinner" /> : <Save size={18} />}
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            ) : (
                                <>
                                    {report.status === 0 && (
                                        <button 
                                            className="btn btn-primary" 
                                            onClick={handleFinalSubmit}
                                            disabled={submitting}
                                            style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600 }}
                                        >
                                            {submitting ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
                                            {submitting ? 'Submitting...' : 'Submit Report'}
                                        </button>
                                    )}

                                    {/* Approve/Reject buttons ONLY for Assignees when status is Submitted (1) */}
                                    {report.status === 1 && isAssignee && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <button 
                                                className="btn btn-primary" 
                                                onClick={() => handleStatusUpdate(2)} 
                                                disabled={submitting}
                                                style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600 }}
                                            >
                                                {submitting ? <Loader2 size={18} className="spinner" /> : <CheckCircle size={18} />}
                                                {submitting ? 'Approving...' : 'Approve'}
                                            </button>
                                            <button 
                                                className="btn btn-secondary" 
                                                onClick={() => handleStatusUpdate(3)} 
                                                disabled={submitting}
                                                style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600 }}
                                            >
                                                {submitting ? <Loader2 size={18} className="spinner" /> : <X size={18} />}
                                                {submitting ? 'Rejecting...' : 'Reject'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Revert to Draft button for Creators when status is Rejected (3) */}
                                    {report.status === 3 && report.userId === user?.userId && (
                                        <button 
                                            className="btn btn-secondary" 
                                            onClick={handleRevertToDraft}
                                            disabled={submitting}
                                            style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600, color: 'var(--accent-color)', borderColor: 'var(--accent-color)', background: 'var(--accent-bg)' }}
                                        >
                                            {submitting ? <Loader2 size={18} className="spinner" /> : <RefreshCw size={18} />}
                                            {submitting ? 'Reverting...' : 'Re-edit (Convert to Draft)'}
                                        </button>
                                    )}
                                </>
                            )}

                            {/* Delete Option - Only available for Draft reports */}
                            {report.status === 0 && (
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={() => setIsDeleteModalOpen(true)}
                                    disabled={submitting}
                                    style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600, color: '#ef4444', borderColor: '#fecaca', background: '#fef2f2' }}
                                >
                                    {submitting ? <Loader2 size={18} className="spinner" /> : <Trash2 size={18} />}
                                    {submitting ? 'Deleting...' : 'Delete Report'}
                                </button>
                            )}

                            {/* AI Indexing Option - Available for non-draft reports */}
                            {report.status !== 0 && (
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={handleEmbedding}
                                    disabled={submitting}
                                    style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600, color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}
                                >
                                    {submitting ? <Loader2 size={18} className="spinner" /> : <Sparkles size={18} color="#0ea5e9" />}
                                    {submitting ? 'Indexing...' : 'Index for AI Search'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals - Project */}
            {isProjectModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Select Project</h3>
                            <button onClick={() => setIsProjectModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '1rem', overflowY: 'auto' }}>
                            {projects.map(p => (
                                <div key={p.id} onClick={() => { setEditData({...editData, projectId: p.id, milestoneId: ''}); setIsProjectModalOpen(false); }} style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '8px', background: editData.projectId === p.id ? '#f1f5f9' : 'transparent' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name || p.projectName}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modals - Assignee */}
            {isAssigneeModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Manage Members</h3>
                            <button onClick={() => setIsAssigneeModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '1rem', overflowY: 'auto' }}>
                            {allUsers.map(u => {
                                const selected = editData.assigneeIds.includes(u.id);
                                return (
                                    <div key={u.id} onClick={() => { setEditData({...editData, assigneeIds: selected ? editData.assigneeIds.filter(id => id !== u.id) : [...editData.assigneeIds, u.id]}) }} style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: selected ? '1px solid var(--primary-color)' : '1px solid transparent' }}>
                                        <div style={{ fontSize: '0.85rem' }}>{u.fullName || u.email}</div>
                                        {selected && <CheckCircle size={16} color="var(--primary-color)" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

             {/* Modals - Milestone */}
             {isMilestoneModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Select Milestone</h3>
                            <button onClick={() => setIsMilestoneModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '1rem', overflowY: 'auto' }}>
                            {milestones.length === 0 ? <p style={{ textAlign: 'center', fontSize: '0.85rem' }}>No milestones for this project.</p> : milestones.map(m => (
                                <div key={m.id} onClick={() => { setEditData({...editData, milestoneId: m.id}); setIsMilestoneModalOpen(false); }} style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '8px', background: editData.milestoneId === m.id ? '#f1f5f9' : 'transparent' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Confirm Submission */}
            {isSubmitModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2rem', textAlign: 'center', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                            <AlertTriangle size={32} color="#ef4444" />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Final Submission</h3>
                        <p style={{ color: '#475569', lineHeight: 1.6, fontSize: '0.95rem', margin: '0 0 2rem 0' }}>
                            Once submitted, <span style={{ fontWeight: 700, color: '#1e293b' }}>this report cannot be edited</span>. 
                            Please carefully check your assignees and content before proceeding.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setIsSubmitModalOpen(false)}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', fontWeight: 600 }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn btn-primary" 
                                onClick={confirmFinalSubmit}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', fontWeight: 600, background: '#ef4444', borderColor: '#ef4444' }}
                            >
                                Submit Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Confirm Delete */}
            {isDeleteModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center', borderRadius: '16px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                            <Trash2 size={32} color="#ef4444" />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Delete Report</h3>
                        <p style={{ color: '#64748b', lineHeight: 1.6, fontSize: '0.95rem', margin: '0 0 2rem 0' }}>
                            Are you sure you want to delete this report? This action <span style={{ fontWeight: 700, color: '#1e293b' }}>cannot be undone</span>.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setIsDeleteModalOpen(false)}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', fontWeight: 600 }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleDelete}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', fontWeight: 600, background: '#ef4444', borderColor: '#ef4444' }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Confirm Status Change */}
            {isStatusModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center', borderRadius: '16px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: pendingStatus === 2 ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                            {pendingStatus === 2 ? <CheckCircle size={32} color="#10b981" /> : <X size={32} color="#ef4444" />}
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0' }}>{pendingStatus === 2 ? 'Approve' : 'Reject'} Report</h3>
                        <p style={{ color: '#64748b', lineHeight: 1.6, fontSize: '0.95rem', margin: '0 0 2rem 0' }}>
                           Are you sure you want to <strong>{pendingStatus === 2 ? 'approve' : 'reject'}</strong> this research report?
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setIsStatusModalOpen(false)}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', fontWeight: 600 }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn btn-primary" 
                                onClick={confirmStatusUpdate}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', fontWeight: 600, background: pendingStatus === 2 ? '#10b981' : '#ef4444', borderColor: pendingStatus === 2 ? '#10b981' : '#ef4444' }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default ReportDetail;
