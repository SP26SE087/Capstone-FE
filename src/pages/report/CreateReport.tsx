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
    Loader2
} from 'lucide-react';
import reportService from '@/services/reportService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { milestoneService } from '@/services/milestoneService';
import Toast, { ToastType } from '@/components/common/Toast';

const CreateReport: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // Meta-data sources
    const [projects, setProjects] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [milestones, setMilestones] = useState<any[]>([]);

    // Modal states
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
    const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);

    // Form data state
    const [formData, setFormData] = useState({
        projectId: '',
        milestoneId: '',
        title: '',
        description: '',
        goals: '',
        achievements: '',
        blockers: '',
        nextWeek: '',
        assigneeIds: [] as string[] // Assignees allowed to be empty initially
    });

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

    useEffect(() => {
        if (formData.projectId) {
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

    const showToast = (message: string, type: ToastType = 'info') => {
        setToast({ message, type });
    };

    const handleSave = async () => {
        if (!formData.title.trim()) {
            return showToast("Please enter a report title to save draft.", "error");
        }
        
        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                userId: user.userId || '',
                projectId: formData.projectId || null,
                milestoneId: formData.milestoneId || null,
            };

            const response = await reportService.createReport(payload);
            const newReport = response?.data || response;

            showToast("Draft saved successfully!", "success");
            
            setTimeout(() => {
                if (newReport?.id) {
                    navigate(`/reports/${newReport.id}`);
                } else {
                    navigate('/reports');
                }
            }, 1000);

        } catch (error: any) {
            console.error('Failed to create report:', error);
            const msg = error.response?.data?.message || error.message || "Failed to create report.";
            showToast(msg, "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.title.trim()) return showToast("Please enter a report title.", "error");
        if (!formData.projectId) return showToast("Please select a project before submitting.", "error");
        if (!formData.milestoneId) return showToast("Please select a milestone before submitting.", "error");
        if (!formData.goals.trim()) return showToast("Please enter strategic goals.", "error");
        if (!formData.achievements.trim()) return showToast("Please enter key achievements.", "error");
        if (!formData.blockers.trim()) return showToast("Please enter current blockers.", "error");
        if (!formData.nextWeek.trim()) return showToast("Please enter future plans.", "error");
        if (formData.assigneeIds.length === 0) return showToast("Please select at least one assignee.", "error");

        setSubmitting(true);
        try {
            // 1. Create the report
            const payload = {
                ...formData,
                userId: user.userId || '',
            };
            const response = await reportService.createReport(payload);
            const newReport = response?.data || response;
            
            if (newReport?.id) {
                // 2. Submit the report (Update status to 1)
                await reportService.updateReportStatus(newReport.id, 1);
                showToast("Report submitted successfully!", "success");
                setTimeout(() => navigate(`/reports/${newReport.id}`), 1000);
            }
        } catch (error: any) {
            console.error('Failed to submit report:', error);
            const msg = error.response?.data?.message || error.message || "Failed to submit report.";
            showToast(msg, "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem' }}>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {/* Header - Minimal with Back button only */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                    <button 
                        onClick={() => navigate('/reports')} 
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}
                    >
                        <ArrowLeft size={20} /> Back to reports
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', alignItems: 'start' }}>
                    {/* Main Content Area */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="card" style={{ padding: '2.5rem', borderRadius: '12px' }}>
                            <div style={{ marginBottom: '2.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    Report Title <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                                </label>
                                <input 
                                    className="form-input" 
                                    style={{ fontSize: '1.5rem', fontWeight: 700, width: '100%', border: 'none', borderBottom: '1px solid #e2e8f0', borderRadius: 0, padding: '4px 0', outline: 'none' }}
                                    value={formData.title}
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    placeholder="Enter report title..."
                                    maxLength={200}
                                    autoFocus
                                />
                                <div style={{ textAlign: 'right', marginTop: '4px' }}>
                                    <span style={{ fontSize: '0.7rem', color: formData.title.length >= 200 ? '#ef4444' : 'var(--text-muted)' }}>
                                        {formData.title.length}/200
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                                {[
                                    { label: 'Description', key: 'description', required: false, max: 2000 },
                                    { label: 'Strategic Goals', key: 'goals', required: true, max: 2000 },
                                    { label: 'Key Achievements', key: 'achievements', required: true, max: 2000 },
                                    { label: 'Current Blockers', key: 'blockers', required: true, max: 2000 },
                                    { label: 'Future Plans', key: 'nextWeek', required: true, max: 2000 }
                                ].map((section) => (
                                    <section key={section.key}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                                {section.label} {section.required && <span style={{ color: '#ef4444' }}>*</span>}
                                            </h3>
                                        </div>
                                        <textarea 
                                            className="form-input" 
                                            style={{ minHeight: '150px', width: '100%', lineHeight: 1.6, fontSize: '0.95rem' }}
                                            value={(formData as any)[section.key]}
                                            onChange={(e) => setFormData({...formData, [section.key]: e.target.value})}
                                            placeholder={`Provide ${section.label.toLowerCase()} details...`}
                                            maxLength={section.max}
                                        />
                                        <div style={{ textAlign: 'right', marginTop: '4px' }}>
                                            <span style={{ fontSize: '0.7rem', color: ((formData as any)[section.key] || '').length >= section.max ? '#ef4444' : 'var(--text-muted)' }}>
                                                {((formData as any)[section.key] || '').length}/{section.max}
                                            </span>
                                        </div>
                                    </section>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Metadata - Adjusted top for fixed header */}
                    <div style={{ position: 'sticky', top: '5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="card" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                            <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Report Info</h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        Project <span style={{ color: '#0ea5e9', fontSize: '0.65rem' }}>(Required for submit)</span>
                                    </label>
                                    <button onClick={() => setIsProjectModalOpen(true)} style={{ width: '100%', textAlign: 'left', border: '1px solid #e2e8f0', background: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Briefcase size={16} />
                                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>
                                            {projects.find(p => p.id === formData.projectId)?.name || projects.find(p => p.id === formData.projectId)?.projectName || 'Select Project'}
                                        </span>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Milestone <span style={{ color: '#0ea5e9', fontSize: '0.65rem' }}>(Required for submit)</span></label>
                                    <button onClick={() => { if (!formData.projectId) return; setIsMilestoneModalOpen(true); }} style={{ width: '100%', textAlign: 'left', border: '1px solid #e2e8f0', background: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: formData.projectId ? 1 : 0.5 }}>
                                        <Zap size={16} />
                                        <span style={{ flex: 1, fontSize: '0.85rem' }}>{milestones.find(m => m.id === formData.milestoneId)?.name || 'Select Milestone'}</span>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        Assignees <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {formData.assigneeIds.map(id => {
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
                                        <button onClick={() => setIsAssigneeModalOpen(true)} style={{ border: '1px dashed #cbd5e1', background: 'none', padding: '6px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                                            Add assignees
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons in Sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button 
                                className="btn btn-secondary" 
                                onClick={handleSave} 
                                disabled={submitting}
                                style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600 }}
                            >
                                {submitting ? <Loader2 size={18} className="spinner" /> : <Save size={18} />}
                                {submitting ? 'Saving...' : 'Save Draft'}
                            </button>

                            <button 
                                className="btn btn-primary" 
                                onClick={handleSubmit}
                                disabled={submitting}
                                style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 600, marginTop: '1rem' }}
                            >
                                <Send size={18} /> Submit Report
                            </button>
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
                                <div key={p.id} onClick={() => { setFormData({...formData, projectId: p.id, milestoneId: ''}); setIsProjectModalOpen(false); }} style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '8px', background: formData.projectId === p.id ? '#f1f5f9' : 'transparent' }}>
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
                    <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Select Assignees</h3>
                            <button onClick={() => { setIsAssigneeModalOpen(false); setUserSearchQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        
                        {/* User Search Bar */}
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
                                    const selected = formData.assigneeIds.includes(u.id);
                                    const getRoleName = (role: any) => {
                                        const r = Number(role);
                                        if (r === 1) return 'Admin';
                                        if (r === 2) return 'Lab Director';
                                        if (r === 3) return 'Senior Researcher';
                                        if (r === 4) return 'Member';
                                        if (r === 5) return 'Guest';
                                        return typeof role === 'string' ? role : 'No Role';
                                    };

                                    return (
                                        <div 
                                            key={u.id} 
                                            onClick={() => { setFormData({...formData, assigneeIds: selected ? formData.assigneeIds.filter(id => id !== u.id) : [...formData.assigneeIds, u.id]}) }} 
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
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{u.fullName || u.name || 'Unknown User'}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span>{u.email}</span>
                                                    <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#cbd5e1' }}></span>
                                                    <span style={{ color: 'var(--primary-color)', fontWeight: 500 }}>{getRoleName(u.role)}</span>
                                                </div>
                                            </div>
                                            {selected && <CheckCircle size={18} color="var(--primary-color)" />}
                                        </div>
                                    );
                            })}
                            {allUsers.filter(u => 
                                (u.fullName || '').toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                                (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase())
                            ).length === 0 && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    No users found matching your search.
                                </div>
                            )}
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
                            {milestones.length === 0 ? <p style={{ textAlign: 'center', fontSize: '0.85rem' }}>No milestones found.</p> : milestones.map(m => (
                                <div key={m.id} onClick={() => { setFormData({...formData, milestoneId: m.id}); setIsMilestoneModalOpen(false); }} style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '8px', background: formData.milestoneId === m.id ? '#f1f5f9' : 'transparent' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default CreateReport;
