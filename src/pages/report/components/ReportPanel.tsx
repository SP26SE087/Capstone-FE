import React, { useState, useEffect } from 'react';
import { 
    X, 
    Edit3,
    Save,
    Send,
    Trash2,
    Loader2,
    RefreshCw,
    Search,
    Plus,
    Check,
    Clock,
    MessageSquare,
    Sparkles
} from 'lucide-react';
import reportService, { Report, UpdateReportRequest } from '@/services/reportService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { milestoneService } from '@/services/milestoneService';
import Toast, { ToastType } from '@/components/common/Toast';
import { useAuth } from '@/hooks/useAuth';
import FeedbackSidebar from './FeedbackSidebar';

interface ReportPanelProps {
    reportId: string | null;
    isAdding: boolean;
    isAuthorFallback?: boolean;
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string, newReportId?: string) => void;
    onTitleChange?: (title: string) => void;
}

const ReportPanel: React.FC<ReportPanelProps> = ({ 
    reportId, 
    isAdding, 
    isAuthorFallback,
    onClose, 
    onSaved,
    onTitleChange
}) => {
    const { user } = useAuth();
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(isAdding);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Metadata
    const [projects, setProjects] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [milestones, setMilestones] = useState<any[]>([]);
    
    // UI Modals
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
    const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
    const [isFeedbackSidebarOpen, setIsFeedbackSidebarOpen] = useState(false);
    const [isFeedbackListOpen, setIsFeedbackListOpen] = useState(false);
    const [expandedFeedbacks, setExpandedFeedbacks] = useState<Set<number>>(new Set());
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [confirmAction, setConfirmAction] = useState<{type: 'delete' | 'submit' | null, event?: React.MouseEvent}>({type: null});

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
    const [initialData, setInitialData] = useState<typeof initialFormData | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');

    const isLabDirector = React.useMemo(() => {
        const role = Number(user?.role);
        return role === 1 || role === 2;
    }, [user?.role]);

    const isAuthor = React.useMemo(() => {
        if (isAdding) return true;
        if (!report || !user) return false;
        
        // If explicitly opened from "My Reports" tab, we trust they are the author
        if (isAuthorFallback) return true;

        // Otherwise, check for multiple possible author ID property names
        const authorId = (report as any).userId || (report as any).UserId || (report as any).createdBy || (report as any).createdByUserId || (report as any).reporterId;
        return authorId?.toString() === user.userId?.toString();
    }, [report, user, isAdding, isAuthorFallback]);

    const hasRejection = React.useMemo(() => {
        if (isAdding || !report) return false;
        const assigneesList = (report as any).assignees || (report as any).Assignees || (report as any).reportReviewers || (report as any).ReportReviewers || [];
        // Support both lowercase and PascalCase status property
        return assigneesList.some((a: any) => (a.status === 3 || a.Status === 3));
    }, [report, isAdding]);


    const isReviewer = React.useMemo(() => {
        if (isAdding || !report) return false;
        const assigneesList = (report as any).assignees || (report as any).Assignees || [];
        return assigneesList.some((a: any) => a.email === user?.email);
    }, [report, user?.email, isAdding]);

    const currentUserHasReviewed = React.useMemo(() => {
        if (isAdding || !report) return false;
        const assigneesList = (report as any).assignees || (report as any).Assignees || [];
        const myEntry = assigneesList.find((a: any) => a.email === user?.email);
        return myEntry && (myEntry.status === 2 || myEntry.status === 3);
    }, [report, user?.email, isAdding]);

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
        if (!isAdding && reportId) {
            fetchReport(reportId);
        } else {
            // New report defaults
            const defaultData = {
                title: '',
                projectId: '',
                milestoneId: '',
                goals: '',
                achievements: '',
                blockers: '',
                nextWeek: '',
                description: '',
                assigneeEmails: [],
                status: 0
            };
            setFormData(defaultData);
            setInitialData(defaultData);
            setLoading(false);
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
            // First ensure we have allUsers to map IDs to Emails if needed
            let currentAllUsers = allUsers;
            if (currentAllUsers.length === 0) {
                try {
                    const uData = await userService.getAll();
                    currentAllUsers = uData || [];
                    setAllUsers(currentAllUsers);
                } catch (e) {
                    console.error("Meta fetch in fetchReport failed", e);
                }
            }

            const r = await reportService.getReportById(id);
            const reportData = r.data || r;
            const finalTitle = reportData.title || 'Untitled';
            
            const fetched = {
                title: finalTitle,
                projectId: reportData.projectId || reportData.ProjectId || '',
                milestoneId: reportData.milestoneId || reportData.MilestoneId || '',
                goals: reportData.goals || reportData.Goals || '',
                achievements: reportData.achievements || reportData.Achievements || '',
                blockers: reportData.blockers || reportData.Blockers || '',
                nextWeek: reportData.nextWeek || reportData.NextWeek || '',
                description: reportData.description || reportData.Description || '',
                assigneeEmails: (() => {
                    const explicitEmails = reportData.assigneeEmails || reportData.AssigneeEmails;
                    if (explicitEmails && Array.isArray(explicitEmails) && explicitEmails.length > 0) {
                        return explicitEmails;
                    }
                    const members = reportData.assignees || reportData.Assignees || reportData.members || reportData.Members || reportData.ReportReviewers || reportData.Reviewers || reportData.reportReviewers;
                    if (members && Array.isArray(members)) {
                        return members.map((a: any) => {
                            const email = a.email || a.Email || a.userEmail || a.UserEmail;
                            if (email) return email;
                            const uId = a.id || a.UserId || a.userId;
                            if (uId && currentAllUsers.length > 0) {
                                const found = currentAllUsers.find(u => u.userId === uId || u.id === uId);
                                if (found?.email) return found.email;
                            }
                            return '';
                        }).filter(e => e !== '');
                    }
                    return reportData.assigneeEmails || reportData.AssigneeEmails || [];
                })(),
                status: reportData.status ?? reportData.Status ?? 0
            };
            
            setFormData(fetched);
            setInitialData(fetched);
            setReport(reportData);
            onTitleChange?.(finalTitle);
            setIsEditMode(false);
        } catch (error: any) {
            console.error('Failed to fetch report:', error);
            showToast(error.message || 'Failed to load report details.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: ToastType = 'info') => {
        setToast({ message, type });
    };

    const handleSave = async (isSubmission: boolean = false, e?: React.MouseEvent, forceSkipConfirm: boolean = false) => {
        if (e) e.preventDefault();
        if (!formData.title.trim()) return showToast("Title is required.", "error");
        if (formData.assigneeEmails.length === 0) return showToast("At least one reviewer is required.", "error");

        if (isSubmission) {
            if (!formData.projectId) return showToast("Project is required for submission.", "error");
            if (!formData.milestoneId) return showToast("Milestone is required for submission.", "error");
            if (!formData.goals?.trim() || !formData.achievements?.trim() || !formData.blockers?.trim() || !formData.nextWeek?.trim()) {
                return showToast("Strategic goals, Achievements, Blockers, and Future plans are required for submission.", "error");
            }
            if (!forceSkipConfirm) {
                setConfirmAction({type: 'submit', event: e});
                return;
            }
        }

        setSubmitting(true);
        try {
            const isDirty = JSON.stringify(formData) !== JSON.stringify(initialData);
            let currentId = reportId;
            const payload: UpdateReportRequest = {
                projectId: formData.projectId === EMPTY_GUID ? null : formData.projectId,
                milestoneId: formData.milestoneId || null,
                title: formData.title,
                description: formData.description || null,
                goals: formData.goals,
                achievements: formData.achievements,
                blockers: formData.blockers,
                nextWeek: formData.nextWeek,
                assigneeEmails: formData.assigneeEmails
            };

            if (isAdding) {
                const createPayload = { ...payload, userId: user?.userId };
                console.log("Creating new report...", createPayload);
                const newReport = await reportService.createReport(createPayload as any);
                currentId = newReport.id;
                
                if (isSubmission && currentId) {
                    console.log("Submitting new report ID:", currentId);
                    await reportService.updateReportStatus(currentId, 1);
                }
            } else if (currentId) {
                // If the user modified the content, save it before submitting
                if (isDirty) {
                    console.log("Saving changes for report ID:", currentId, payload);
                    await reportService.updateReport(currentId, payload);
                }
                
                if (isSubmission) {
                    console.log("Patching status for report ID:", currentId);
                    await reportService.updateReportStatus(currentId, 1);
                }
            }
            
            // Critical: notify parent of success
            onSaved(false, isSubmission ? (isAdding ? 'Report created and submitted!' : 'Report submitted successfully.') : (isAdding ? 'Report draft created.' : 'Changes saved successfully.'), currentId || undefined);
            
            if (!isAdding && currentId) {
                await fetchReport(currentId);
            }
        } catch (error: any) {
            console.error('Save error:', error);
            showToast(error.response?.data?.message || 'Failed to process report.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusUpdate = async (newStatus: number, e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        if (!reportId) return;
        setSubmitting(true);
        try {
            await reportService.updateReportStatus(reportId, newStatus);
            const msg = `Status updated successfully.`;
            showToast(msg, 'success');
            fetchReport(reportId);
            onSaved(false, msg);
        } catch (error: any) {
            showToast(error.message || 'Failed to update status.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFeedbackSubmit = async (status: number) => {
        if (!reportId) return;
        setSubmitting(true);
        try {
            await reportService.updateAssignee(reportId, { status, feedback: feedbackText });
            const msg = `Report ${status === 2 ? 'approved' : 'rejected'}.`;
            showToast(msg, 'success');
            fetchReport(reportId);
            onSaved(false, msg);
        } catch (error: any) {
            showToast(error.message || 'Failed to update reviewer status.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = () => setConfirmAction({type: 'delete'});

    const executeDelete = async () => {
        if (!reportId) return;
        setSubmitting(true);
        try {
            await reportService.deleteReport(reportId);
            const msg = 'Report deleted successfully.';
            showToast(msg, 'success');
            onSaved(true, msg);
            onClose();
        } catch (error: any) {
            showToast(error.message || 'Failed to delete report.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

const handleAiSuggest = async () => {
        if (!reportId) return;
        setIsAiLoading(true);
        try {
            const response = await reportService.getAiFeedback(reportId);
            // The API returns { success: true, data: { feedback: "..." } }
            const suggestion = response?.data?.feedback || response?.feedback || response?.content || (typeof response === 'string' ? response : '');
            
            if (suggestion) {
                setFeedbackText(suggestion);
                showToast('AI suggestion loaded.', 'success');
            } else {
                showToast('AI could not generate feedback for this report.', 'info');
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to load AI suggestion.', 'error');
        } finally {
            setIsAiLoading(false);
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

    const filteredUsers = allUsers.filter(u => {
        const matchesSearch = u.fullName?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                             u.email?.toLowerCase().includes(userSearchQuery.toLowerCase());
        const isNotSelf = u.email !== user?.email;
        return matchesSearch && isNotSelf;
    });

    const getStatusInfo = (status: number) => {
        switch (status) {
            case 0: return { label: 'Drafting', color: '#64748b', bg: '#f8fafc' };
            case 1: return { label: 'Submitted', color: '#0ea5e9', bg: '#f0f9ff' };
            case 2: return { label: 'Approved', color: '#10b981', bg: '#ecfdf5' };
            case 3: return { label: 'Revision', color: '#ef4444', bg: '#fef2f2' };
            default: return { label: 'Unknown', color: '#94a3b8', bg: '#f1f5f9' };
        }
    };

    const statusInfo = getStatusInfo(formData.status);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fcfdfe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isAdding ? 'Create New Report' : isEditMode ? 'Edit Report' : 'Report Details'}
                            {!isAdding && report && (
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    background: (report as any)?.hasEmbedding ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : '#f1f5f9',
                                    color: (report as any)?.hasEmbedding ? '#166534' : '#64748b',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.02em',
                                    border: `1px solid ${(report as any)?.hasEmbedding ? '#bbf7d0' : '#e2e8f0'}`,
                                    marginLeft: '8px'
                                }}>
                                    <Sparkles size={12} /> {(report as any)?.hasEmbedding ? 'Can Semantic Search' : 'Cannot Semantic Search'}
                                </span>
                            )}
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
                    
                    {/* Title */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Report Title <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            {isEditMode && <span style={{ fontSize: '0.6rem', color: formData.title.length >= 200 ? '#ef4444' : '#94a3b8', fontWeight: 700 }}>{formData.title.length}/200</span>}
                        </div>
                        
                        {isEditMode ? (
                            <input 
                                className="form-input" 
                                value={formData.title} 
                                onChange={e => {
                                    setFormData({...formData, title: e.target.value});
                                    onTitleChange?.(e.target.value);
                                }}
                                maxLength={200}
                                placeholder="Enter a concise title..."
                                style={{ fontSize: '1rem', fontWeight: 700, padding: '12px', borderRadius: '10px' }}
                            />
                        ) : (
                            <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.3 }}>{formData.title}</h3>
                        )}
                    </div>

                    {/* Content Sections */}
                    {[
                        { label: 'Description', key: 'description' as const, required: false },
                        { label: 'Strategic Goals', key: 'goals' as const, required: true },
                        { label: 'Key Achievements', key: 'achievements' as const, required: true },
                        { label: 'Current Blockers', key: 'blockers' as const, required: true },
                        { label: 'Future Plans', key: 'nextWeek' as const, required: true }
                    ].map(section => (
                        <div key={section.key}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {section.label} {section.required && <span style={{ color: '#ef4444' }}>*</span>}
                                </label>
                                {isEditMode && <span style={{ fontSize: '0.55rem', color: formData[section.key].length >= 2000 ? '#ef4444' : '#94a3b8', fontWeight: 800 }}>{formData[section.key].length}/2000</span>}
                            </div>
                            {isEditMode ? (
                                <textarea 
                                    className="form-input"
                                    value={formData[section.key]}
                                    onChange={e => setFormData({...formData, [section.key]: e.target.value})}
                                    maxLength={2000}
                                    style={{ minHeight: '80px', fontSize: '0.85rem', padding: '10px', borderRadius: '8px', background: '#fcfdfe', border: '1px solid #e2e8f0' }}
                                />
                            ) : (
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {formData[section.key] || `No ${section.label.toLowerCase()} provided.`}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* Reviewers List */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>
                                Reviewers <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            {isEditMode && (
                                <button onClick={() => setIsAssigneeModalOpen(true)} style={{ border: 'none', background: 'none', color: 'var(--primary-color)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Plus size={12} /> Add Reviewer
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

                    {/* Status, Project & Milestone Context */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                            <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Status</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: statusInfo.color }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusInfo.color }}></div>
                                <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>{statusInfo.label}</span>
                            </div>
                        </div>
                        <div
                            onClick={() => isEditMode && setIsProjectModalOpen(true)}
                            style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: isEditMode ? '#fff' : '#f8fafc', border: isEditMode ? '2px dashed var(--primary-color)33' : '1px solid #f1f5f9', cursor: isEditMode ? 'pointer' : 'default', minWidth: 0 }}
                        >
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
                                Project <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
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
                                opacity: (isEditMode && !formData.projectId) ? 0.6 : 1,
                                gridColumn: '1 / -1'
                            }}
                        >
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
                                Milestone <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}>
                                {(() => {
                                    const m = milestones.find(ms => (ms.milestoneId || ms.id) === formData.milestoneId);
                                    return m?.title || m?.name || 'Select Milestone';
                                })()}
                            </span>
                        </div>
                    </div>

                    {/* Reviewer Status Summary */}
                    {formData.status !== 0 && (
                        <>
                            <div style={{ padding: '0.85rem 1rem', borderRadius: '14px', background: '#f8fafc', border: '1px solid #eef2f6', display: 'flex', alignItems: 'center', gap: '1rem', overflowX: 'auto' }} className="custom-scrollbar-thin">
                                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Reviewer Status</div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap' }}>
                                    {(() => {
                                        const reviewList = (report as any)?.assignees || (report as any)?.Assignees || [];
                                        if (reviewList.length === 0) return <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Individual Report</span>;
                                        
                                        return reviewList.map((rev: any, idx: number) => {
                                            const rStatus = rev.status;
                                            let config = { label: 'Reviewing', color: '#94a3b8', bg: '#f1f5f9', icon: <Clock size={10} /> };
                                            if (rStatus === 2) config = { label: 'Approved', color: '#10b981', bg: '#ecfdf5', icon: <Check size={10} /> };
                                            if (rStatus === 3) config = { label: 'Rejected', color: '#ef4444', bg: '#fef2f2', icon: <X size={10} /> };
                                            
                                            return (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: config.bg, border: `1px solid ${config.color}20` }}>
                                                    <div style={{ color: config.color, display: 'flex' }}>{config.icon}</div>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>{rev.fullName || 'Member'}</span>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: config.color, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{config.label}</span>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Feedback List (inline collapsible) */}
                    {!isAdding && !isEditMode && formData.status !== 0 && (() => {
                        const reviewList = (report as any)?.assignees || (report as any)?.Assignees || [];
                        const feedbackList = reviewList.filter((r: any) => r.status > 1 || r.feedback);
                        if (feedbackList.length === 0) return null;

                        const PREVIEW_CHARS = 150;

                        return (
                            <div style={{ borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                {/* Header toggle */}
                                <button
                                    type="button"
                                    onClick={() => setIsFeedbackListOpen(o => !o)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0.75rem 1rem', background: '#f8fafc', border: 'none', cursor: 'pointer',
                                        borderBottom: isFeedbackListOpen ? '1px solid #e2e8f0' : 'none'
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <MessageSquare size={13} color="var(--primary-color)" />
                                        Feedback List
                                        <span style={{ padding: '1px 7px', borderRadius: '10px', background: 'var(--primary-color)', color: '#fff', fontSize: '0.6rem', fontWeight: 700 }}>
                                            {feedbackList.length}
                                        </span>
                                    </span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                        style={{ transform: isFeedbackListOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>

                                {/* Feedback items */}
                                {isFeedbackListOpen && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                        {feedbackList.map((rev: any, idx: number) => {
                                            const isApproved = rev.status === 2;
                                            const isRejected = rev.status === 3;
                                            const color = isApproved ? '#10b981' : isRejected ? '#ef4444' : '#94a3b8';
                                            const bg = isApproved ? '#ecfdf5' : isRejected ? '#fef2f2' : '#f8fafc';
                                            const statusLabel = isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Reviewing';
                                            const feedbackText: string = rev.feedback || '';
                                            const isLong = feedbackText.length > PREVIEW_CHARS;
                                            const isExpanded = expandedFeedbacks.has(idx);

                                            return (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        padding: '0.9rem 1rem',
                                                        borderBottom: idx < feedbackList.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                        background: '#fff'
                                                    }}
                                                >
                                                    {/* Reviewer header */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{
                                                                width: '28px', height: '28px', borderRadius: '50%',
                                                                background: '#f1f5f9', border: '1px solid #e2e8f0',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.75rem', fontWeight: 700, color: '#475569', flexShrink: 0
                                                            }}>
                                                                {rev.fullName?.[0]?.toUpperCase() || 'U'}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{rev.fullName || 'Reviewer'}</div>
                                                                {rev.email && <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{rev.email}</div>}
                                                            </div>
                                                        </div>
                                                        <div style={{
                                                            padding: '3px 8px', borderRadius: '6px', background: bg,
                                                            color, fontSize: '0.6rem', fontWeight: 700,
                                                            textTransform: 'uppercase', letterSpacing: '0.04em',
                                                            display: 'flex', alignItems: 'center', gap: '3px',
                                                            border: `1px solid ${color}25`
                                                        }}>
                                                            {isApproved && <Check size={10} />}
                                                            {isRejected && <X size={10} />}
                                                            {statusLabel}
                                                        </div>
                                                    </div>

                                                    {/* Feedback text */}
                                                    {feedbackText ? (
                                                        <div style={{
                                                            padding: '10px 12px', background: '#f8fafc', borderRadius: '8px',
                                                            borderLeft: `3px solid ${color}`,
                                                            fontSize: '0.8rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap'
                                                        }}>
                                                            {isLong && !isExpanded
                                                                ? feedbackText.slice(0, PREVIEW_CHARS) + '…'
                                                                : feedbackText
                                                            }
                                                            {isLong && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setExpandedFeedbacks(prev => {
                                                                        const next = new Set(prev);
                                                                        isExpanded ? next.delete(idx) : next.add(idx);
                                                                        return next;
                                                                    })}
                                                                    style={{
                                                                        display: 'block', marginTop: '4px', background: 'none', border: 'none',
                                                                        color: '#2563eb', fontSize: '0.75rem', fontWeight: 700,
                                                                        cursor: 'pointer', padding: 0
                                                                    }}
                                                                >
                                                                    {isExpanded ? 'View less' : 'View more'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No written feedback.</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Reviewer Feedback Section */}
                    {isReviewer && !currentUserHasReviewed && formData.status !== 0 && !isEditMode && (
                        <div style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '16px', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <label style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Your Review Feedback
                                </label>
                                <button 
                                    type="button" 
                                    onClick={handleAiSuggest} 
                                    disabled={isAiLoading || submitting}
                                    style={{ padding: '4px 10px', borderRadius: '8px', border: 'none', background: '#fef3c7', color: '#92400e', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    {isAiLoading ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                    AI Suggest
                                </button>
                            </div>
                            <textarea
                                className="form-input"
                                value={feedbackText}
                                onChange={e => setFeedbackText(e.target.value)}
                                placeholder="Add comments for the author (optional)..."
                                style={{ minHeight: '100px', fontSize: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky Actions Footer */}
            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9', background: '#fcfdfe', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {!isAdding && !isEditMode && formData.status === 0 && (
                        <button 
                            type="button" 
                            onClick={handleDelete} 
                            disabled={submitting} 
                            style={{ 
                                padding: '8px 16px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, 
                                border: '1px solid #fee2e2', background: '#fff5f5', color: '#ef4444',
                                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.borderColor = '#fee2e2'; }}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    )}
                    {!isAdding && !isEditMode && (formData.status === 1 || formData.status === 2) && (
                       <button
                            type="button"
                            onClick={handleIndexing}
                            disabled={submitting || (report as any)?.hasEmbedding}
                            className="btn btn-secondary"
                            style={{ gap: '6px', fontSize: '0.8rem' }}
                        >
                            {(report as any)?.hasEmbedding ? <Check size={14} /> : <RefreshCw size={14} className={submitting ? 'animate-spin' : ''} />}
                            {(report as any)?.hasEmbedding ? 'Semantic Search' : 'Insert to Semantic Search'}
                       </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {isEditMode ? (
                        <>
                            <button type="button" onClick={isAdding ? onClose : () => setIsEditMode(false)} className="btn btn-secondary" disabled={submitting}>Cancel</button>
                            <button type="button" onClick={(e) => handleSave(false, e)} disabled={submitting} className="btn btn-secondary" style={{ gap: '8px' }}>
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {isAdding ? 'Save Draft' : 'Save Changes'}
                            </button>
                            {/* Only allow Submit directly for NEW reports. Existing reports must Save first. */}
                            {isAdding && (
                                <button type="button" onClick={(e) => handleSave(true, e)} disabled={submitting} className="btn btn-primary" style={{ gap: '8px' }}>
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    Submit
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Actions for Author: Drafting mode OR Rejection mode */}
                            {!isAdding && isAuthor && (formData.status === 0 || formData.status === 3 || hasRejection) && (
                                <>
                                    <button 
                                        type="button"
                                        onClick={(e) => handleSave(true, e)} 
                                        disabled={submitting}
                                        className="btn btn-primary" 
                                        style={{ gap: '8px', fontWeight: 600 }}
                                    >
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        {(formData.status === 0) ? "Submit Report" : "Resubmit Report"}
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsEditMode(true)} 
                                        className="btn btn-secondary" 
                                        style={{ gap: '8px' }}
                                    >
                                        <Edit3 size={16} /> Edit
                                    </button>
                                </>
                            )}
                            {isReviewer && !currentUserHasReviewed && formData.status !== 0 && (
                                <>
                                    <button type="button" onClick={() => handleFeedbackSubmit(3)} disabled={submitting} className="btn btn-secondary" style={{ color: '#f59e0b', gap: '6px' }}>
                                        {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                                        Request Revision
                                    </button>
                                    <button type="button" onClick={() => handleFeedbackSubmit(2)} disabled={submitting} className="btn btn-primary" style={{ background: '#10b981', gap: '6px' }}>
                                        {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                                        Approve Report
                                    </button>
                                </>
                            )}
                            {(formData.status === 1) && isLabDirector && !isReviewer && (
                                <>
                                    <button type="button" onClick={(e) => handleStatusUpdate(3, e)} disabled={submitting} className="btn btn-secondary" style={{ color: '#f59e0b', gap: '6px' }}>
                                        {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                                        Request Revision
                                    </button>
                                    <button type="button" onClick={(e) => handleStatusUpdate(2, e)} disabled={submitting} className="btn btn-primary" style={{ background: '#10b981', gap: '6px' }}>
                                        {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                                        Approve Report
                                    </button>
                                </>
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
            {/* Component-Level Feedback Sidebar */}
            <FeedbackSidebar 
                isOpen={isFeedbackSidebarOpen} 
                onClose={() => setIsFeedbackSidebarOpen(false)} 
                report={report} 
            />

            {/* Custom Confirmation Modal */}
            {confirmAction.type && (
                <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }}
                    onClick={() => setConfirmAction({type: null})}
                >
                    <div 
                        style={{ width: '100%', maxWidth: '380px', background: 'white', borderRadius: '24px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1rem', transform: 'scale(1)', animation: 'fadeIn 0.2s ease-out' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>
                            {confirmAction.type === 'delete' ? 'Delete Report' : 'Submit Report'}
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                            {confirmAction.type === 'delete' 
                                ? 'Are you sure you want to delete this report? This action cannot be undone.' 
                                : 'Are you sure you want to finalize and submit this report? Reviewers will be notified immediately to evaluate your work.'}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '0.75rem' }}>
                            <button 
                                onClick={() => setConfirmAction({type: null})} 
                                className="btn btn-secondary" 
                                style={{ flex: 1, padding: '10px', fontWeight: 700 }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    if (confirmAction.type === 'delete') {
                                        executeDelete();
                                    } else {
                                        handleSave(true, confirmAction.event, true);
                                    }
                                    setConfirmAction({type: null});
                                }} 
                                className="btn" 
                                style={{ 
                                    flex: 1, 
                                    padding: '10px',
                                    fontWeight: 700,
                                    background: confirmAction.type === 'delete' ? '#ef4444' : 'var(--primary-color)', 
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                {confirmAction.type === 'delete' ? 'Delete' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ReportPanel;
