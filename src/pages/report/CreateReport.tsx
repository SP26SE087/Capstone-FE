import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import {
    ArrowLeft,
    X,
    CheckCircle,
    ChevronRight,
    Briefcase,
    Zap,
    Save,
    Send,
    Search,
    Loader2,
    Plus,
    Trash2,
    FileText,
    AlertCircle
} from 'lucide-react';
import reportService, { BulkReportCreateResult } from '@/services/reportService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { milestoneService } from '@/services/milestoneService';
import { useToastStore } from '@/store/slices/toastSlice';
import { validateSpecialChars } from '@/utils/validation';

const CreateReport: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [submitting, setSubmitting] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    const [bulkResults, setBulkResults] = useState<BulkReportCreateResult[] | null>(null);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [showValidation, setShowValidation] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Meta-data sources
    const [projects, setProjects] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [milestones, setMilestones] = useState<any[]>([]);

    // Modal states
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
    const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
    const [isConfirmBackOpen, setIsConfirmBackOpen] = useState(false);

    // Multiple Reports State
    const initialFormState = {
        id: null as string | null, // Track saved items
        projectId: '',
        milestoneId: '',
        title: '',
        description: '',
        goals: '',
        achievements: '',
        blockers: '',
        nextWeek: '',
        assigneeEmails: [] as string[]
    };

    const [reports, setReports] = useState([{ ...initialFormState }]);
    const [activeIndex, setActiveIndex] = useState(0);

    const activeReport = reports[activeIndex];

    // Flexible role check
    const isLabDirector = React.useMemo(() => {
        const role = user?.role;
        if (!role) return false;
        const roleNum = Number(role);
        return roleNum === 1 || roleNum === 2 || String(role).toLowerCase().includes('director') || String(role).toLowerCase().includes('admin');
    }, [user?.role]);

    useEffect(() => {
        if (isLabDirector) {
            navigate('/reports');
        }
    }, [isLabDirector, navigate]);

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

    const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

    useEffect(() => {
        if (activeReport.projectId && activeReport.projectId !== EMPTY_GUID) {
            fetchMilestones(activeReport.projectId);
        } else {
            setMilestones([]);
        }
    }, [activeReport.projectId, activeIndex]);

    const fetchMilestones = async (projectId: string) => {
        if (!projectId || projectId === EMPTY_GUID) {
            setMilestones([]);
            return;
        }
        try {
            const data = await milestoneService.getByProject(projectId);
            setMilestones(data || []);
        } catch (err) {
            console.error("Failed to load milestones", err);
        }
    };

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const { addToast } = useToastStore();
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => addToast(message, type);

    const handleBack = () => {
        if (isDirty) {
            setIsConfirmBackOpen(true);
        } else {
            navigate('/reports');
        }
    };

    const updateActiveReport = (updates: Partial<typeof initialFormState>) => {
        const newReports = [...reports];
        newReports[activeIndex] = { ...newReports[activeIndex], ...updates };
        setReports(newReports);
        setIsDirty(true);
    };

    const addNewReport = () => {
        setReports([...reports, { ...initialFormState, title: `Report ${reports.length + 1}` }]);
        setActiveIndex(reports.length);
        setIsDirty(true);
    };

    const removeReport = (index: number) => {
        if (reports.length === 1) return;
        const newReports = reports.filter((_, i) => i !== index);
        setReports(newReports);
        setIsDirty(true);
        if (activeIndex >= newReports.length) {
            setActiveIndex(newReports.length - 1);
        }
    };

    const validateReport = (report: typeof initialFormState, index: number, isFinal: boolean) => {
        if (!report.title.trim()) return `Report #${index + 1}: Title is required.`;
        if (validateSpecialChars(report.title)) return `Report #${index + 1}: Title — ${validateSpecialChars(report.title)}`;
        if (report.assigneeEmails.length === 0) return `Report #${index + 1}: At least one assignee is required.`;
        
        if (isFinal) {
            if (!report.projectId) return `Report #${index + 1}: Project is required.`;
            if (!report.milestoneId) return `Report #${index + 1}: Milestone is required.`;
            if (!report.goals.trim()) return `Report #${index + 1}: Goals are required.`;
            if (validateSpecialChars(report.goals)) return `Report #${index + 1}: Goals — ${validateSpecialChars(report.goals)}`;
            if (!report.achievements.trim()) return `Report #${index + 1}: Achievements are required.`;
            if (validateSpecialChars(report.achievements)) return `Report #${index + 1}: Achievements — ${validateSpecialChars(report.achievements)}`;
            if (!report.blockers.trim()) return `Report #${index + 1}: Blockers are required.`;
            if (validateSpecialChars(report.blockers)) return `Report #${index + 1}: Blockers — ${validateSpecialChars(report.blockers)}`;
            if (!report.nextWeek.trim()) return `Report #${index + 1}: Future plans are required.`;
            if (validateSpecialChars(report.nextWeek)) return `Report #${index + 1}: Future plans — ${validateSpecialChars(report.nextWeek)}`;
            if (report.description && validateSpecialChars(report.description)) return `Report #${index + 1}: Description — ${validateSpecialChars(report.description)}`;
        }
        return null;
    };

    // Custom Dropdown State
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSingleSubmit = async (isSubmission: boolean) => {
        const error = validateReport(activeReport, activeIndex, isSubmission);
        if (error) return showToast(error, "error");

        setSubmitting(true);
        try {
            const payload: any = {
                ...activeReport,
                userId: user.userId,
                projectId: activeReport.projectId || null,
                milestoneId: activeReport.milestoneId || null,
            };

            let reportId = activeReport.id;

            if (reportId) {
                // Update existing
                await reportService.updateReport(reportId, payload);
                if (isSubmission) {
                    await reportService.updateReportStatus(reportId, 1);
                }
                showToast(`Report updated and ${isSubmission ? 'submitted' : 'saved as draft'}!`, "success");
            } else {
                // Create new
                const savedReport = await reportService.createReport(payload);
                reportId = savedReport.id || savedReport.data?.id;

                if (reportId) {
                    updateActiveReport({ id: reportId });
                    if (isSubmission) {
                        await reportService.updateReportStatus(reportId, 1);
                    }
                }
                showToast(`Report ${isSubmission ? 'submitted' : 'saved as draft'}!`, "success");
            }
            
            setIsDirty(false); // Reset dirty flag after successful single action
            
            if (isSubmission && reportId) {
                setTimeout(() => navigate(`/reports/${reportId}`), 1000);
            }

        } catch (error: any) {
            console.error('Action failed:', error);
            showToast(error.response?.data?.message || "Operation failed", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleBulkSubmit = async (isSubmission: boolean) => {
        setShowValidation(true);
        // Validate all
        for (let i = 0; i < reports.length; i++) {
            const error = validateReport(reports[i], i, isSubmission);
            if (error) {
                setActiveIndex(i);
                return showToast(error, "error");
            }
        }

        setSubmitting(true);
        try {
            const results: BulkReportCreateResult[] = [];

            // Partition into new and existing
            const toCreate = reports.filter(r => !r.id);
            const toUpdate = reports.filter(r => r.id);

            // Handle New Reports
            if (toCreate.length > 0) {
                const createPayload = toCreate.map(r => ({
                    ...r,
                    userId: user.userId || '',
                    projectId: r.projectId || null,
                    milestoneId: r.milestoneId || null,
                }));

                const data = await reportService.createBulkReports(createPayload);
                const createResults: BulkReportCreateResult[] = data?.data || data;

                // Update local status with IDs for future clicks
                const newReports = [...reports];
                createResults.forEach(res => {
                    if (res.success && res.report?.id) {
                        const originalIndex = reports.findIndex(r => r.title === res.request?.title && !r.id);
                        if (originalIndex !== -1) {
                            newReports[originalIndex].id = res.report.id;
                        }
                    }
                });
                setReports(newReports);
                results.push(...createResults);
            }

            // Handle Updates for existing reports
            if (toUpdate.length > 0) {
                await Promise.all(toUpdate.map(async (r) => {
                    try {
                        await reportService.updateReport(r.id!, {
                            ...r,
                            projectId: r.projectId || null,
                            milestoneId: r.milestoneId || null,
                        } as any);

                        if (isSubmission) {
                            await reportService.updateReportStatus(r.id!, 1);
                        }

                        results.push({
                            index: -1, // Not strictly needed for UI here
                            request: r as any,
                            success: true,
                            report: r as any,
                            errorMessage: null
                        });
                    } catch (err: any) {
                        results.push({
                            index: -1,
                            request: r as any,
                            success: false,
                            report: null,
                            errorMessage: err.response?.data?.message || err.message || "Update failed"
                        });
                    }
                }));
            }

            setBulkResults(results);

            const successCount = results.filter(r => r.success).length;
            const failCount = results.length - successCount;

            // Optional: for newly created reports that need status 1
            if (isSubmission && toCreate.length > 0) {
                const successfulNew = results.filter(r => r.success && r.report?.id && !toUpdate.some(u => u.id === r.report?.id));
                await Promise.all(successfulNew.map(r =>
                    reportService.updateReportStatus(r.report!.id, 1)
                ));
            }

            if (failCount === 0) {
                showToast(`Successfully processed ${successCount} reports!`, "success");
                setIsDirty(false); // Reset dirty flag after successful bulk action
            } else {
                showToast(`${successCount} succeeded, ${failCount} failed.`, "warning");
                setIsResultModalOpen(true);
            }

        } catch (error: any) {
            console.error('Failed to create reports:', error);
            const msg = error.response?.data?.message || error.message || "Failed to process reports.";
            showToast(msg, "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <style>
                {`
                    @keyframes pulse-red {
                        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                        70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
                        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                    }
                `}
            </style>
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <button
                        onClick={handleBack}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}
                    >
                        <ArrowLeft size={20} /> Back to reports
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Custom Dropdown Container */}
                        <div ref={dropdownRef} style={{ position: 'relative' }}>
                            <div
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    background: 'white',
                                    padding: '8px 16px',
                                    borderRadius: '12px',
                                    border: `1px solid ${isDropdownOpen ? 'var(--primary-color)' : (showValidation && validateReport(activeReport, activeIndex, true)) ? '#ef444466' : '#e2e8f0'}`,
                                    boxShadow: isDropdownOpen ? '0 0 0 3px var(--primary-color)22' : '0 1px 2px rgba(0,0,0,0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    width: '240px',
                                    position: 'relative'
                                }}
                            >
                                {(showValidation && validateReport(activeReport, activeIndex, true)) && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-4px',
                                        right: '-4px',
                                        width: '12px',
                                        height: '12px',
                                        background: '#ef4444',
                                        borderRadius: '50%',
                                        border: '2px solid white',
                                        animation: 'pulse-red 2s infinite',
                                        zIndex: 10
                                    }} />
                                )}
                                <div style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '10px', background: (showValidation && validateReport(activeReport, activeIndex, true)) ? '#fef2f2' : 'var(--primary-color)11', color: (showValidation && validateReport(activeReport, activeIndex, true)) ? '#ef4444' : 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {(showValidation && validateReport(activeReport, activeIndex, true)) ? <AlertCircle size={18} /> : <FileText size={18} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {projects.find(p => (p.projectId || p.id) === activeReport.projectId)?.name || projects.find(p => (p.projectId || p.id) === activeReport.projectId)?.projectName || 'Draft Report'}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        #{activeIndex + 1}. {activeReport.title || 'Untitled'}
                                    </div>
                                </div>
                                <ChevronRight
                                    size={14}
                                    style={{
                                        flexShrink: 0,
                                        color: '#94a3b8',
                                        transform: `rotate(${isDropdownOpen ? '270deg' : '90deg'})`,
                                        transition: 'transform 0.3s'
                                    }}
                                />
                            </div>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    marginTop: '8px',
                                    left: 0,
                                    width: '320px',
                                    background: 'white',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                                    zIndex: 100,
                                    overflow: 'hidden',
                                    padding: '8px'
                                }}>
                                    <div style={{ padding: '8px 12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batch Items List</div>
                                    <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                                        {reports.map((r, i) => (
                                            <div
                                                key={i}
                                                onClick={() => { setActiveIndex(i); setIsDropdownOpen(false); }}
                                                style={{
                                                    padding: '12px',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    background: activeIndex === i ? 'var(--primary-color)08' : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    marginBottom: '2px',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => { if (activeIndex !== i) e.currentTarget.style.background = '#f8fafc'; }}
                                                onMouseOut={(e) => { if (activeIndex !== i) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <div style={{
                                                    flexShrink: 0,
                                                    width: '28px', height: '28px', borderRadius: '8px',
                                                    background: activeIndex === i ? 'var(--primary-color)' : '#f1f5f9',
                                                    color: activeIndex === i ? 'white' : '#64748b',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800
                                                }}>
                                                    {i + 1}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: (showValidation && validateReport(r, i, true)) ? '#ef4444' : activeIndex === i ? 'var(--primary-color)' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {r.title || 'Untitled Report'}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: (showValidation && validateReport(r, i, true)) ? '#f87171' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {projects.find(p => (p.projectId || p.id) === r.projectId)?.name || projects.find(p => (p.projectId || p.id) === r.projectId)?.projectName || 'Project not selected'}
                                                    </div>
                                                </div>
                                                {(showValidation && validateReport(r, i, true)) ? (
                                                    <div style={{
                                                        width: '10px',
                                                        height: '10px',
                                                        background: '#ef4444',
                                                        borderRadius: '50%',
                                                        animation: 'pulse-red 2s infinite',
                                                        flexShrink: 0
                                                    }} />
                                                ) : activeIndex === i && (
                                                    <CheckCircle size={18} color="var(--primary-color)" style={{ flexShrink: 0 }} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div
                                        onClick={() => { addNewReport(); setIsDropdownOpen(false); }}
                                        style={{ marginTop: '4px', padding: '10px 12px', borderRadius: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                        onMouseOver={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                                        onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <Plus size={16} /> Add a new report item
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={addNewReport}
                            style={{
                                height: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '0 20px',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'var(--primary-color)',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 6px -1px var(--primary-color)33'
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                            <Plus size={18} color="white" /> New Report
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', alignItems: 'start' }}>

                    {/* Main Content Area */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Report Management Bar (Inner) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)' }}></div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Item {activeIndex + 1} of {reports.length}
                                    </span>
                                </div>
                                {activeReport.id && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700 }}>
                                        <CheckCircle size={10} /> Saved
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {reports.length > 1 && (
                                    <button
                                        onClick={() => removeReport(activeIndex)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', opacity: '0.8' }}
                                        onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
                                        onMouseOut={(e) => (e.currentTarget.style.opacity = '0.8')}
                                    >
                                        <Trash2 size={14} /> 
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="card" style={{ padding: '1.5rem 2rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.04)' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                                    Report Title <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                                </label>
                                <input
                                    className="form-input"
                                    style={{ fontSize: '1.25rem', fontWeight: 700, width: '100%', border: 'none', borderBottom: '1px solid #e2e8f0', borderRadius: 0, padding: '4px 0', outline: 'none' }}
                                    value={activeReport.title}
                                    onChange={(e) => updateActiveReport({ title: e.target.value })}
                                    placeholder="Enter report title..."
                                    maxLength={200}
                                />
                                <div style={{ textAlign: 'right', marginTop: '4px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: (activeReport.title || '').length >= 200 ? '#ef4444' : '#94a3b8' }}>
                                        {(activeReport.title || '').length}/200
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {[
                                    { label: 'Description', key: 'description' as const, required: true, max: 2000, placeholder: 'Detailed content of the report...' },
                                    { label: 'Goals', key: 'goals' as const, required: true, max: 2000, placeholder: 'What are your goals this week?' },
                                    { label: 'Achievements', key: 'achievements' as const, required: true, max: 2000, placeholder: 'What have you achieved?' },
                                    { label: 'Issues', key: 'blockers' as const, required: true, max: 2000, placeholder: 'Are there any challenges or blockers?' },
                                    { label: 'Plans', key: 'nextWeek' as const, required: true, max: 2000, placeholder: 'What are your plans for next week?' }
                                ].map((section) => (
                                    <section key={section.key}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                {section.label} {section.required && <span style={{ color: '#ef4444' }}>*</span>}
                                            </h3>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: (activeReport[section.key] || '').length >= section.max ? '#ef4444' : '#94a3b8' }}>
                                                {(activeReport[section.key] || '').length}/{section.max}
                                            </span>
                                        </div>
                                        <textarea
                                            className="form-input"
                                            style={{ minHeight: '120px', width: '100%', lineHeight: 1.6, fontSize: '0.9rem', padding: '12px', background: '#fcfdfe' }}
                                            value={activeReport[section.key]}
                                            onChange={(e) => updateActiveReport({ [section.key]: e.target.value })}
                                            placeholder={section.placeholder}
                                            maxLength={section.max}
                                        />
                                    </section>
                                ))}

                                <div style={{
                                    marginTop: '1rem',
                                    paddingTop: '2rem',
                                    borderTop: '1px solid #f1f5f9',
                                    display: 'flex',
                                    gap: '12px'
                                }}>
                                    <button
                                        className="btn btn-secondary"
                                        disabled={submitting}
                                        onClick={() => handleSingleSubmit(false)}
                                        style={{ flex: 1, padding: '12px', fontWeight: 700 }}
                                    >
                                        {activeReport.id ? 'Update Draft' : 'Save Draft'}
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        disabled={submitting}
                                        onClick={() => handleSingleSubmit(true)}
                                        style={{ flex: 1, padding: '12px', fontWeight: 700 }}
                                    >
                                        Submit Report
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Metadata */}
                    <div style={{ position: 'sticky', top: '5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="card" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                            <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Report Info</h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                                        Project <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <button onClick={() => setIsProjectModalOpen(true)} style={{ width: '100%', textAlign: 'left', border: '1px solid #e2e8f0', background: 'white', padding: '12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-sm)' }}>
                                        <Briefcase size={16} color="var(--primary-color)" />
                                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {projects.find(p => (p.projectId || p.id) === activeReport.projectId)?.name || projects.find(p => (p.projectId || p.id) === activeReport.projectId)?.projectName || 'Select Project'}
                                        </span>
                                        <ChevronRight size={14} color="#94a3b8" />
                                    </button>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                                        Milestone <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <button onClick={() => { if (!activeReport.projectId) return; setIsMilestoneModalOpen(true); }} style={{ width: '100%', textAlign: 'left', border: '1px solid #e2e8f0', background: 'white', padding: '12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: activeReport.projectId ? 1 : 0.5, boxShadow: 'var(--shadow-sm)' }}>
                                        <Zap size={16} color="#f59e0b" />
                                        <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{milestones.find(m => (m.milestoneId || m.id) === activeReport.milestoneId)?.name || 'Select Milestone'}</span>
                                        <ChevronRight size={14} color="#94a3b8" />
                                    </button>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        Reviewers <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {activeReport.assigneeEmails.map(email => {
                                            const u = allUsers.find(user => user.email === email);
                                            return u ? (
                                                <div key={email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px' }}>
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                        {u.fullName?.charAt(0) || u.name?.charAt(0)}
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem' }}>{u.fullName || u.name}</span>
                                                </div>
                                            ) : (
                                                <div key={email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px' }}>
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                        ?
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem' }}>{email}</span>
                                                </div>
                                            );
                                        })}
                                        <button onClick={() => setIsAssigneeModalOpen(true)} style={{ border: '1px dashed #cbd5e1', background: 'none', padding: '6px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                                            Add reviewers
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Batch Action Buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h4 style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Batch Actions</h4>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleBulkSubmit(false)}
                                disabled={submitting}
                                style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600 }}
                            >
                                {submitting ? <Loader2 size={18} className="spinner" /> : <Save size={18} />}
                                {submitting ? 'Saving Batch...' : 'Save All as Draft'}
                            </button>

                            <button
                                className="btn btn-primary"
                                onClick={() => handleBulkSubmit(true)}
                                disabled={submitting}
                                style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600 }}
                            >
                                {submitting ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
                                {submitting ? 'Submitting Batch...' : 'Submit All Reports'}
                            </button>

                            <div style={{ padding: '0.75rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #f1f5f9', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontWeight: 600 }}>
                                    <AlertCircle size={14} /> Batch Summary
                                </div>
                                <div>• Total: {reports.length} reports</div>
                                <div>• Ready: {reports.filter((r, i) => validateReport(r, i, true) === null).length} items</div>
                            </div>
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
                                <div 
                                    key={p.projectId || p.id} 
                                    onClick={() => { updateActiveReport({ projectId: (p.projectId || p.id), milestoneId: '' }); }} 
                                    style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '8px', background: activeReport.projectId === (p.projectId || p.id) ? 'var(--primary-color)10' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: activeReport.projectId === (p.projectId || p.id) ? 'var(--primary-color)' : '#1e293b' }}>{p.name || p.projectName}</div>
                                    {activeReport.projectId === (p.projectId || p.id) && <CheckCircle size={18} color="var(--primary-color)" />}
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '1rem', borderTop: '1px solid #f1f5f9' }}>
                            <button onClick={() => setIsProjectModalOpen(false)} className="btn btn-primary" style={{ width: '100%', height: '40px', borderRadius: '10px', fontWeight: 700 }}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals - Reviewer */}
            {isAssigneeModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Select Reviewers</h3>
                            <button onClick={() => { setIsAssigneeModalOpen(false); setUserSearchQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search by name or email..."
                                    style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ padding: '0.5rem', overflowY: 'auto' }}>
                            {allUsers
                                .filter(u =>
                                    (u.fullName || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                    (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                    (u.name || '').toLowerCase().includes(userSearchQuery.toLowerCase())
                                )
                                .map(u => {
                                    const selected = activeReport.assigneeEmails.includes(u.email);
                                    return (
                                        <div
                                            key={u.email}
                                            onClick={() => {
                                                const email = u.email;
                                                const newEmails = selected
                                                    ? activeReport.assigneeEmails.filter(e => e !== email)
                                                    : [...activeReport.assigneeEmails, email];
                                                updateActiveReport({ assigneeEmails: newEmails });
                                            }}
                                            style={{
                                                padding: '12px',
                                                margin: '4px 8px',
                                                cursor: 'pointer',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                gap: '12px',
                                                alignItems: 'center',
                                                border: selected ? '1px solid var(--primary-color)' : '1px solid transparent',
                                                background: selected ? 'var(--primary-color)05' : 'transparent',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                background: selected ? 'var(--primary-color)' : '#f1f5f9',
                                                color: selected ? 'white' : '#64748b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.9rem',
                                                fontWeight: 700
                                            }}>
                                                {(u.fullName || u.name || u.email).charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{u.fullName || u.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                                            </div>
                                            {selected && <CheckCircle size={18} color="var(--primary-color)" />}
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
                            {milestones.length === 0 ? (
                                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', padding: '1rem' }}>No milestones found.</p>
                            ) : milestones.map(m => (
                                <div 
                                    key={m.milestoneId || m.id} 
                                    onClick={() => { updateActiveReport({ milestoneId: (m.milestoneId || m.id) }); }} 
                                    style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '8px', background: activeReport.milestoneId === (m.milestoneId || m.id) ? 'var(--primary-color)10' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: activeReport.milestoneId === (m.milestoneId || m.id) ? 'var(--primary-color)' : '#1e293b' }}>{m.name || m.title}</div>
                                    {activeReport.milestoneId === (m.milestoneId || m.id) && <CheckCircle size={18} color="var(--primary-color)" />}
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '1rem', borderTop: '1px solid #f1f5f9' }}>
                            <button onClick={() => setIsMilestoneModalOpen(false)} className="btn btn-primary" style={{ width: '100%', height: '40px', borderRadius: '10px', fontWeight: 700 }}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Bulk Results Details */}
            {isResultModalOpen && bulkResults && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Create Report Results</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Some reports could not be processed.</p>
                            </div>
                            <button onClick={() => setIsResultModalOpen(false)} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                        </div>
                        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {bulkResults.map((res, i) => (
                                <div key={i} style={{ padding: '12px', borderRadius: '12px', border: `1px solid ${res.success ? '#bbf7d0' : '#fecaca'}`, background: res.success ? '#f0fdf4' : '#fef2f2', display: 'flex', gap: '12px' }}>
                                    {res.success ? <CheckCircle size={20} color="#166534" /> : <AlertCircle size={20} color="#991b1b" />}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: res.success ? '#166534' : '#991b1b' }}>
                                            {res.request?.title || `Report #${res.index + 1}`}
                                        </div>
                                        {!res.success && <div style={{ fontSize: '0.8rem', color: '#991b1b', marginTop: '4px' }}>{res.errorMessage || 'Unknown server error'}</div>}
                                        {res.success && <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: '4px' }}>Created successfully.</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setIsResultModalOpen(false)}>Close & Fix</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Unsaved Changes Confirmation */}
            {isConfirmBackOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '400px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                                <AlertCircle size={32} />
                            </div>
                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>Unsaved Changes</h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>You have modified some reports. If you leave now, your changes will be lost. Are you sure?</p>
                        </div>
                        <div style={{ padding: '1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setIsConfirmBackOpen(false)} style={{ flex: 1, height: '44px', fontWeight: 700 }}>Stay here</button>
                            <button 
                                className="btn" 
                                onClick={() => { setIsConfirmBackOpen(false); setIsDirty(false); navigate('/reports'); }} 
                                style={{ flex: 1, height: '44px', fontWeight: 700, backgroundColor: '#e11d48', color: 'white', border: 'none' }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#be123c')}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#e11d48')}
                            >
                                Leave anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </MainLayout>
    );
};

export default CreateReport;
