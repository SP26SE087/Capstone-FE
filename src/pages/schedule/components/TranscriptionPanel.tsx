import React, { useState, useEffect, useRef } from 'react';
import { useTranscriptionStore } from '@/store/slices/transcriptionStore';
import { validateTextField } from '@/utils/validation';
import {
    transcriptionService,
    TranscriptionResponse,
    TranscriptionMeetingListItemResponse,
    TranscriptionModel,
    TaskSuggestion
} from '@/services/transcriptionService';
import { projectService } from '@/services';
import { milestoneService } from '@/services';
import { taskService } from '@/services/taskService';
import { userService } from '@/services';
import { membershipService } from '@/services/membershipService';
import { useToastStore } from '@/store/slices/toastSlice';
import {
    Mic, FileAudio, Loader2, ChevronDown, ChevronUp,
    Sparkles, ClipboardList, Plus, Save, X, Check,
    User, FileText, Video, Target, RefreshCw, FileSearch, AlertTriangle, Edit3
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SystemRoleEnum } from '@/types/enums';

interface TranscriptionPanelProps {
    onClose: () => void;
    meetingId?: string;
    meetingName?: string;
    onProcessingChange?: (processing: boolean) => void;
}

const sectionStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '10px'
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 800, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.8px',
    marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px'
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '9px',
    border: '1.5px solid #e2e8f0', fontSize: '0.85rem',
    fontFamily: 'inherit', outline: 'none', background: '#fff',
    boxSizing: 'border-box' as const
};

const LANGUAGES = [
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'en', label: 'English' },
];

interface SuggestedTask extends TaskSuggestion {
    _expanded: boolean;
    _assigneeId: string;
    _saving: boolean;
    _saved: boolean;
}

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ onClose, meetingId, meetingName, onProcessingChange }) => {
    const { addToast } = useToastStore();
    const { user: authUser } = useAuth();
    const authRole = String(authUser.role ?? '');
    const isLabDirector = Number(authRole) === SystemRoleEnum.LabDirector || authRole === 'LabDirector' || authRole === 'Lab Director';

    // Meeting transcriptions
    const [meetingTranscriptions, setMeetingTranscriptions] = useState<TranscriptionMeetingListItemResponse[]>([]);
    const [loadingMeeting, setLoadingMeeting] = useState(false);

    // Step 1 – Upload & transcribe
    const [models, setModels] = useState<TranscriptionModel[]>([]);
    const [selectedModel, setSelectedModel] = useState('gpt-4o-transcribe');
    const [language, setLanguage] = useState('vi');
    const [file, setFile] = useState<File | null>(null);
    const [transcribing, setTranscribing] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Step 2 – Transcript result  (lazy-initialised from global store when same meeting)
    const [transcription, setTranscription] = useState<TranscriptionResponse | null>(() => {
        const s = useTranscriptionStore.getState();
        return (s.transcription && (meetingId ?? null) === s.meetingId) ? s.transcription : null;
    });

    // Step 2b – Reload
    const [reloading, setReloading] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Step 3 – Summary
    const [summarizing, setSummarizing] = useState(false);
    const [summary, setSummary] = useState<string | null>(() => {
        const s = useTranscriptionStore.getState();
        return (s.transcription && (meetingId ?? null) === s.meetingId) ? s.summary : null;
    });
    const [summaryLanguage, setSummaryLanguage] = useState('vi');
    const [summaryLength, setSummaryLength] = useState('medium');
    const [summaryStyle, setSummaryStyle] = useState('paragraph');
    const [customPrompt, setCustomPrompt] = useState('');

    // Step 4 – Suggest tasks
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState(() => {
        const s = useTranscriptionStore.getState();
        return (s.transcription && (meetingId ?? null) === s.meetingId) ? s.selectedProjectId : '';
    });
    const [milestones, setMilestones] = useState<{ id: string; name: string; startDate?: string; dueDate?: string }[]>([]);
    const [selectedMilestoneId, setSelectedMilestoneId] = useState('');
    const selectedMilestone = milestones.find(m => m.id === selectedMilestoneId) || null;
    const [suggesting, setSuggesting] = useState(false);
    const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTask[]>(() => {
        const s = useTranscriptionStore.getState();
        return (s.transcription && (meetingId ?? null) === s.meetingId)
            ? s.suggestedTasks.map(t => ({ ...t, _saving: false } as SuggestedTask))
            : [];
    });
    const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
    const [projectMembers, setProjectMembers] = useState<{ id: string; name: string; email: string }[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'tasks'>(() => {
        const s = useTranscriptionStore.getState();
        return (s.transcription && (meetingId ?? null) === s.meetingId) ? s.activeTab : 'transcript';
    });
    const [showConfirmClose, setShowConfirmClose] = useState(false);

    // Edit summary — only the user who created the transcription can edit summary
    const [editingSummary, setEditingSummary] = useState(false);
    const [editSummaryText, setEditSummaryText] = useState('');
    const [savingSummary, setSavingSummary] = useState(false);
    const canEditSummary = !!transcription && (isLabDirector || (!!authUser.email && transcription.createdByEmail === authUser.email));

    // Sync state changes to the global store so they survive route navigation
    // Use getState() instead of subscribing to avoid re-render loops
    useEffect(() => {
        if (meetingId !== undefined) useTranscriptionStore.getState().setTranscription(transcription);
    }, [transcription, meetingId]);
    useEffect(() => {
        if (meetingId !== undefined) useTranscriptionStore.getState().setSummary(summary);
    }, [summary, meetingId]);
    useEffect(() => {
        if (meetingId !== undefined) useTranscriptionStore.getState().setSuggestedTasks(suggestedTasks as any);
    }, [suggestedTasks, meetingId]);
    useEffect(() => {
        if (meetingId !== undefined) useTranscriptionStore.getState().setActiveTab(activeTab);
    }, [activeTab, meetingId]);
    useEffect(() => {
        if (meetingId !== undefined) useTranscriptionStore.getState().setSelectedProjectId(selectedProjectId);
    }, [selectedProjectId, meetingId]);

    // Confirm before leaving if processing
    useEffect(() => {
        const isProcessing = transcribing || summarizing || suggesting || reloading;
        if (onProcessingChange) onProcessingChange(isProcessing);
        if (!isProcessing) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'A process is currently running. Leaving now might lose information. Are you sure?';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [transcribing, summarizing, suggesting, reloading]);

    const handleClose = () => {
        const isProcessing = transcribing || summarizing || suggesting || reloading;
        if (isProcessing) {
            setShowConfirmClose(true);
        } else {
            onClose();
        }
    };

    const handleConfirmCloseModal = () => {
        setShowConfirmClose(false);
        onClose();
    };

    // Auto-poll while transcription is still processing
    useEffect(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        const id = transcription?.id;
        if (!id || transcription?.status === 'Completed' || transcription?.status === 'Failed' || !!transcription?.transcribedText) {
            return;
        }

        pollingRef.current = setInterval(async () => {
            const result = await transcriptionService.getById(id);
            if (result) {
                setTranscription(result);
                if (result.summary) setSummary(prev => prev || result.summary);
                if (result.status === 'Completed' || result.status === 'Failed' || !!result.transcribedText) {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    pollingRef.current = null;
                    if (result.transcribedText) addToast('Transcription completed!', 'success');
                }
            }
        }, 15000);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [transcription?.id, transcription?.status, transcription?.transcribedText]);

    useEffect(() => {
        transcriptionService.getModels().then(m => {
            setModels(m);
            const defaultModel = m.find(x => x.id === 'gpt-4o-transcribe');
            setSelectedModel(defaultModel?.id || (m.length > 0 ? m[0].id || '' : 'gpt-4o-transcribe'));
        });
        projectService.getAll().then(list => {
            setProjects(list.map((p: any) => ({
                id: p.projectId || p.id,
                name: p.projectName || p.name || 'Untitled'
            })));
        });
        userService.getAll().then((list: any[]) => {
            setAllUsers(list.map(u => ({
                id: u.userId || u.id,
                name: u.fullName || u.name || '',
                email: u.email || ''
            })));
        });
    }, []);

    // Fetch meeting transcriptions
    const handleLoadMeetingTranscriptions = async (silent = false) => {
        if (!meetingId) return;
        setLoadingMeeting(true);
        try {
            const list = await transcriptionService.getByMeeting(meetingId);
            setMeetingTranscriptions(list);
            if (!silent) {
                if (list.length === 0) {
                    addToast('No transcriptions found for this meeting.', 'info');
                } else {
                    addToast(`Found ${list.length} transcription(s).`, 'success');
                }
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to load meeting transcriptions.';
            addToast(msg, 'error');
        } finally {
            setLoadingMeeting(false);
        }
    };

    useEffect(() => {
        if (meetingId) {
            handleLoadMeetingTranscriptions(true);
        }
    }, [meetingId]);

    const handleSelectTranscription = async (t: TranscriptionMeetingListItemResponse) => {
        setReloading(true);
        try {
            const full = await transcriptionService.getById(t.id);
            if (full) {
                setTranscription(full);
                if (full.summary) setSummary(full.summary);
                addToast('Transcription loaded.', 'success');
            }
        } catch {
            addToast('Failed to load transcription details.', 'error');
        } finally {
            setReloading(false);
        }
    };

    useEffect(() => {
        if (!selectedProjectId) {
            setMilestones([]);
            setSelectedMilestoneId('');
            setProjectMembers([]);
            setCurrentUserRole(null);
            return;
        }
        milestoneService.getByProject(selectedProjectId).then((list: any[]) => {
            setMilestones(list.map((m: any) => ({
                id: m.milestoneId || m.id,
                name: m.name || m.title || 'Milestone',
                startDate: m.startDate || null,
                dueDate: m.dueDate || null,
            })));
        });
        
        projectService.getCurrentMember(selectedProjectId).then(member => {
            setCurrentUserRole(member?.projectRole ?? null);
        }).catch(() => setCurrentUserRole(null));

        membershipService.getProjectMembers(selectedProjectId).then((members: any[]) => {
            setProjectMembers(members.map((m: any) => ({
                id: m.memberId || m.id,
                name: m.fullName || m.userName || m.email || '',
                email: m.email || ''
            })));
        }).catch(() => setProjectMembers(allUsers));
    }, [selectedProjectId, allUsers]);

    // ── Transcribe ──────────────────────────────────────────────────────────
    const handleTranscribe = async () => {
        if (!file) return;
        setTranscribing(true);
        setTranscription(null);
        setSummary(null);
        setSuggestedTasks([]);
        setActiveTab('transcript');
        try {
            const result = await transcriptionService.transcribe(file, meetingId, selectedModel || undefined, language || undefined);
            setTranscription(result);
            if (result.transcribedText || result.status === 'Completed') {
                if (result.summary) setSummary(result.summary);
                addToast('Transcription completed successfully!', 'success');
            } else {
                addToast('Transcription submitted. Will auto-refresh when ready.', 'info');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Transcription failed.';
            addToast(msg, 'error');
        } finally {
            setTranscribing(false);
        }
    };

    // ── Reload transcription ─────────────────────────────────────────────────
    const handleReload = async () => {
        if (!transcription?.id) return;
        setReloading(true);
        try {
            const result = await transcriptionService.getById(transcription.id);
            if (result) {
                setTranscription(result);
                if (result.summary) {
                    setSummary(result.summary);
                }
                if (result.transcribedText) {
                    addToast('Transcription loaded successfully!', 'success');
                } else {
                    addToast('Still processing... try again in a moment.', 'warning');
                }
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to reload transcription.';
            addToast(msg, 'error');
        } finally {
            setReloading(false);
        }
    };

    // ── Summarize ────────────────────────────────────────────────────────────
    const handleSummarize = async () => {
        if (!transcription?.id) return;
        setSummarizing(true);
        setActiveTab('summary');
        try {
            const result = await transcriptionService.summarize(transcription.id, {
                language: summaryLanguage,
                length: summaryLength,
                style: summaryStyle,
                customPrompt: customPrompt.trim() || undefined
            });
            if (result.success) {
                setSummary(result.summary);
                addToast('Summary generated successfully!', 'success');
            } else {
                addToast(result.errorMessage || 'Failed to generate summary.', 'error');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to generate summary.';
            addToast(msg, 'error');
        } finally {
            setSummarizing(false);
        }
    };

    // ── Suggest tasks ─────────────────────────────────────────────────────────
    const handleSuggest = async () => {
        const textToUse = summary || transcription?.transcribedText;
        if (!textToUse || !selectedProjectId) return;
        setSuggesting(true);
        setSuggestedTasks([]);
        setActiveTab('tasks');
        try {
            const list = await transcriptionService.suggestTasks(
                textToUse,
                selectedProjectId,
                selectedMilestoneId || undefined
            );
            const msStart = selectedMilestone?.startDate ? selectedMilestone.startDate.split('T')[0] : null;
            const msEnd = selectedMilestone?.dueDate ? selectedMilestone.dueDate.split('T')[0] : null;
            const isInRange = (date: string | null | undefined) => {
                if (!date || !msStart || !msEnd) return false;
                const d = date.split('T')[0];
                return d >= msStart && d <= msEnd;
            };
            setSuggestedTasks(list.map(t => ({
                ...t,
                startDate: isInRange(t.startDate) ? t.startDate : (msStart || t.startDate),
                dueDate: isInRange(t.dueDate) ? t.dueDate : (msEnd || t.dueDate),
                _expanded: false, _assigneeId: '', _saving: false, _saved: false,
            })));
            addToast(`${list.length} tasks suggested!`, 'success');
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to suggest tasks.';
            addToast(msg, 'error');
        } finally {
            setSuggesting(false);
        }
    };

    const toggleTask = (idx: number) => {
        setSuggestedTasks(prev => prev.map((t, i) => i === idx ? { ...t, _expanded: !t._expanded } : t));
    };

    const updateTaskField = (idx: number, field: keyof SuggestedTask, value: any) => {
        setSuggestedTasks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
    };

    const handleSaveTask = async (idx: number) => {
        const task = suggestedTasks[idx];
        if (!selectedProjectId) { addToast('Please select a project first.', 'error'); return; }
        const nameErr = validateTextField(task.name, 'Task name', { required: true });
        if (nameErr) { addToast(nameErr, 'error'); return; }
        const descErr = validateTextField(task.description || '', 'Description');
        if (descErr) { addToast(`Description: ${descErr}`, 'error'); return; }
        setSuggestedTasks(prev => prev.map((t, i) => i === idx ? { ...t, _saving: true } : t));
        try {
            const today = new Date().toISOString().split('T')[0];
            await taskService.create({
                name: task.name,
                description: task.description || '',
                priority: task.priority ?? 2,
                status: task.status || 1,
                memberId: task._assigneeId || task.assigneeId || null,
                projectId: selectedProjectId,
                milestoneId: task.milestoneId || selectedMilestoneId || null,
                startDate: new Date(task.startDate || today).toISOString(),
                dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
                estimatedHours: task.estimatedHours ?? null,
                tags: task.tags ?? [],
                // Add any other fields from suggestion
                ...(['evidence','supportMembers','customFields'].reduce((acc, key) => {
                    if (task[key]) acc[key] = task[key];
                    return acc;
                }, {} as any))
            });
            setSuggestedTasks(prev => prev.map((t, i) => i === idx ? { ...t, _saving: false, _saved: true } : t));
            addToast(`Task "${task.name}" created.`, 'success');
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to create task.';
            addToast(msg, 'error');
            setSuggestedTasks(prev => prev.map((t, i) => i === idx ? { ...t, _saving: false } : t));
        }
    };

    const hasTranscript = !!transcription?.transcribedText;
    const hasSummary = !!summary;

    const handleStartEditSummary = () => {
        setEditSummaryText(summary || '');
        setEditingSummary(true);
    };

    const handleCancelEditSummary = () => {
        setEditingSummary(false);
        setEditSummaryText('');
    };

    const handleSaveSummary = async () => {
        if (!transcription?.id) return;
        setSavingSummary(true);
        try {
            await transcriptionService.updateSummary(transcription.id, editSummaryText);
            setSummary(editSummaryText);
            setEditingSummary(false);
            addToast('Summary updated successfully!', 'success');
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to update summary.';
            addToast(msg, 'error');
        } finally {
            setSavingSummary(false);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '16px', height: '100%' }}>

            {/* ════════ LEFT: AI Notes Controls ════════ */}
            <div style={{
                flex: '0 0 25%', maxWidth: '25%',
                display: 'flex', flexDirection: 'column',
                background: '#fff', borderRadius: '16px',
                border: '1.5px solid #e0e7ff', padding: '12px',
                boxShadow: '0 4px 20px rgba(99,102,241,0.08)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '7px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
                        }}>
                            <Mic size={13} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>AI Notes</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                {(['Upload', 'Transcript', 'Summary', 'Tasks'] as const).map((step, i) => {
                                    const reached = i === 0 ? true : i === 1 ? hasTranscript : i === 2 ? hasSummary : suggestedTasks.length > 0;
                                    const active = i === 0 ? !hasTranscript : i === 1 ? hasTranscript && !hasSummary : i === 2 ? hasSummary && suggestedTasks.length === 0 : suggestedTasks.length > 0;
                                    return (
                                        <React.Fragment key={step}>
                                            <span style={{
                                                fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px', borderRadius: '20px',
                                                background: active ? '#6366f1' : reached ? '#e0e7ff' : '#f1f5f9',
                                                color: active ? '#fff' : reached ? '#6366f1' : '#94a3b8',
                                                transition: 'all 0.3s'
                                            }}>{step}</span>
                                            {i < 3 && <span style={{ fontSize: '0.5rem', color: '#cbd5e1' }}>{'\u203A'}</span>}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        title="Close"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', borderRadius: '6px',
                            border: '1px solid #e2e8f0', background: '#fff',
                            color: '#94a3b8', cursor: 'pointer', flexShrink: 0,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                    >
                        <X size={13} />
                    </button>
                </div>

                {/* Scrollable controls */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '2px' }} className="custom-scrollbar">

                    {/* Load meeting transcriptions */}
                    {meetingId && (
                        <div style={sectionStyle}>
                            <div style={labelStyle}><FileSearch size={12} /> Meeting Transcriptions</div>
                            <button
                                onClick={() => handleLoadMeetingTranscriptions(false)}
                                disabled={loadingMeeting}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '10px', border: 'none',
                                    background: loadingMeeting ? '#e2e8f0' : 'linear-gradient(135deg,#8b5cf6,#6366f1)',
                                    color: loadingMeeting ? '#94a3b8' : '#fff',
                                    cursor: loadingMeeting ? 'not-allowed' : 'pointer',
                                    fontWeight: 700, fontSize: '0.78rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                    boxShadow: loadingMeeting ? 'none' : '0 4px 12px rgba(99,102,241,0.25)'
                                }}
                            >
                                {loadingMeeting
                                    ? <><Loader2 size={13} className="animate-spin" /> Loading...</>
                                    : <><RefreshCw size={13} /> Load Transcriptions</>
                                }
                            </button>
                        </div>
                    )}

                    {/* Upload section */}
                    <div style={sectionStyle}>
                        <div style={labelStyle}><FileAudio size={12} /> Audio File</div>
                        <div
                            onClick={() => fileRef.current?.click()}
                            style={{
                                border: `2px dashed ${file ? '#6366f1' : '#e2e8f0'}`,
                                borderRadius: '10px', padding: '10px 12px',
                                textAlign: 'center', cursor: 'pointer',
                                background: file ? '#f5f3ff' : '#fafafa',
                                marginBottom: '8px', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#f5f3ff'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = file ? '#6366f1' : '#e2e8f0'; e.currentTarget.style.background = file ? '#f5f3ff' : '#fafafa'; }}
                        >
                            <input
                                ref={fileRef}
                                type="file"
                                accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.ogg,.webm"
                                style={{ display: 'none' }}
                                onChange={e => setFile(e.target.files?.[0] || null)}
                            />
                            <FileAudio size={20} color={file ? '#6366f1' : '#94a3b8'} style={{ marginBottom: '4px' }} />
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: file ? '#6366f1' : '#64748b' }}>
                                {file ? file.name : 'Click to select file'}
                            </div>
                            {file && (
                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>
                                    {(file.size / 1024 / 1024).toFixed(1)} MB
                                </div>
                            )}
                        </div>

                        {/* Model + Language */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Model</label>
                                <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} style={{ ...inputStyle, height: '32px', fontSize: '0.76rem' }}>
                                    {models.length === 0
                                        ? <option value="">Default</option>
                                        : models.map(m => <option key={m.id || ''} value={m.id || ''}>{m.name || m.id}</option>)
                                    }
                                </select>
                            </div>
                            <div style={{ flex: '0 0 90px' }}>
                                <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Language</label>
                                <select value={language} onChange={e => setLanguage(e.target.value)} style={{ ...inputStyle, height: '32px', fontSize: '0.76rem' }}>
                                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleTranscribe}
                            disabled={!file || transcribing}
                            style={{
                                width: '100%', padding: '8px', borderRadius: '10px', border: 'none',
                                background: !file || transcribing ? '#e2e8f0' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                                color: !file || transcribing ? '#94a3b8' : '#fff',
                                cursor: !file || transcribing ? 'not-allowed' : 'pointer',
                                fontWeight: 700, fontSize: '0.78rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                boxShadow: !file || transcribing ? 'none' : '0 4px 12px rgba(99,102,241,0.25)'
                            }}
                        >
                            {transcribing ? <><Loader2 size={13} className="animate-spin" /> Transcribing...</> : <><Mic size={13} /> Transcribe</>}
                        </button>
                    </div>

                    {/* Reload button when pending */}
                    {transcription && !hasTranscript && (
                        <div style={sectionStyle}>
                            <div style={{ fontSize: '0.75rem', color: '#92400e', marginBottom: '8px', textAlign: 'center', fontWeight: 600 }}>
                                <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                                Processing...
                            </div>
                            <button
                                onClick={handleReload}
                                disabled={reloading}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '10px', border: 'none',
                                    background: reloading ? '#e2e8f0' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
                                    color: reloading ? '#94a3b8' : '#fff',
                                    cursor: reloading ? 'not-allowed' : 'pointer',
                                    fontWeight: 700, fontSize: '0.78rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                    boxShadow: reloading ? 'none' : '0 4px 12px rgba(59,130,246,0.25)'
                                }}
                            >
                                {reloading
                                    ? <><Loader2 size={13} className="animate-spin" /> Loading...</>
                                    : <><RefreshCw size={13} /> Reload</>
                                }
                            </button>
                        </div>
                    )}

                    {/* Summarize controls */}
                    {hasTranscript && (
                        <div style={sectionStyle}>
                            <div style={labelStyle}><Sparkles size={12} /> {hasSummary ? 'Re-generate Summary' : 'Summary'}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Language</label>
                                        <select value={summaryLanguage} onChange={e => setSummaryLanguage(e.target.value)} style={{ ...inputStyle, height: '32px', fontSize: '0.76rem' }}>
                                            <option value="vi">Tiếng Việt</option>
                                            <option value="en">English</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Length</label>
                                        <select value={summaryLength} onChange={e => setSummaryLength(e.target.value)} style={{ ...inputStyle, height: '32px', fontSize: '0.76rem' }}>
                                            <option value="short">Short</option>
                                            <option value="medium">Medium</option>
                                            <option value="long">Long</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Format</label>
                                    <select value={summaryStyle} onChange={e => setSummaryStyle(e.target.value)} style={{ ...inputStyle, height: '32px', fontSize: '0.76rem' }}>
                                        <option value="paragraph">Paragraph</option>
                                        <option value="bullet_points">Bullet Points</option>
                                        <option value="key_points">Key Points</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Custom Prompt (optional)</label>
                                    <textarea
                                        value={customPrompt}
                                        onChange={e => setCustomPrompt(e.target.value)}
                                        placeholder="e.g. Focus on action items and deadlines..."
                                        style={{
                                            ...inputStyle, minHeight: '48px', resize: 'vertical',
                                            fontSize: '0.76rem', fontFamily: 'inherit'
                                        }}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleSummarize}
                                disabled={summarizing}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '10px', border: 'none',
                                    background: summarizing ? '#e2e8f0' : 'linear-gradient(135deg,#10b981,#059669)',
                                    color: summarizing ? '#94a3b8' : '#fff',
                                    cursor: summarizing ? 'not-allowed' : 'pointer',
                                    fontWeight: 700, fontSize: '0.78rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                    boxShadow: summarizing ? 'none' : '0 4px 12px rgba(16,185,129,0.25)'
                                }}
                            >
                                {summarizing
                                    ? <><Loader2 size={13} className="animate-spin" /> Generating...</>
                                    : hasSummary
                                        ? <><RefreshCw size={13} /> Re-generate Summary</>
                                        : <><Sparkles size={13} /> Generate Summary</>
                                }
                            </button>
                        </div>
                    )}

                    {/* Suggest Tasks controls */}
                    {(hasTranscript || hasSummary) && (
                        <div style={sectionStyle}>
                            <div style={labelStyle}><ClipboardList size={12} /> Suggest Tasks</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                                <div>
                                    <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Project *</label>
                                    <select
                                        value={selectedProjectId}
                                        onChange={e => { setSelectedProjectId(e.target.value); setSelectedMilestoneId(''); setSuggestedTasks([]); }}
                                        style={{ ...inputStyle, height: '32px', fontSize: '0.76rem' }}
                                    >
                                        <option value="">Select project...</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Milestone</label>
                                    <select
                                        value={selectedMilestoneId}
                                        onChange={e => setSelectedMilestoneId(e.target.value)}
                                        disabled={!selectedProjectId || milestones.length === 0}
                                        style={{ ...inputStyle, height: '32px', fontSize: '0.76rem', background: !selectedProjectId ? '#f8fafc' : '#fff' }}
                                    >
                                        <option value="">No milestone</option>
                                        {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            {currentUserRole !== null && currentUserRole !== 1 && currentUserRole !== 4 && (
                                <div style={{ fontSize: '0.65rem', color: '#dc2626', marginBottom: '8px', fontWeight: 600 }}>
                                    Must be a Lab Director or Leader to generate tasks.
                                </div>
                            )}
                            <button
                                onClick={handleSuggest}
                                disabled={!selectedProjectId || suggesting || (currentUserRole !== 1 && currentUserRole !== 4)}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '10px', border: 'none',
                                    background: !selectedProjectId || suggesting ? '#e2e8f0' : 'linear-gradient(135deg,#f59e0b,#f97316)',
                                    color: !selectedProjectId || suggesting ? '#94a3b8' : '#fff',
                                    cursor: !selectedProjectId || suggesting ? 'not-allowed' : 'pointer',
                                    fontWeight: 700, fontSize: '0.78rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                    boxShadow: !selectedProjectId || suggesting ? 'none' : '0 4px 12px rgba(249,115,22,0.2)'
                                }}
                            >
                                {suggesting ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : <><Target size={13} /> Suggest Tasks</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ════════ CENTER: Tabs Content ════════ */}
            <div style={{
                flex: 1, minWidth: 0,
                display: 'flex', flexDirection: 'column',
                background: '#fff', borderRadius: '16px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', userSelect: 'none', flexShrink: 0 }}>
                    <div onClick={() => setActiveTab('transcript')} style={{
                        flex: 1, textAlign: 'center', padding: '10px 12px', cursor: 'pointer',
                        borderBottom: activeTab === 'transcript' ? '2.5px solid #6366f1' : '2.5px solid transparent',
                        fontWeight: activeTab === 'transcript' ? 700 : 600,
                        color: activeTab === 'transcript' ? '#6366f1' : '#94a3b8',
                        background: activeTab === 'transcript' ? '#fff' : 'transparent',
                        fontSize: '0.82rem', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                    }}>
                        <FileText size={13} /> Transcript
                    </div>
                    <div onClick={() => setActiveTab('summary')} style={{
                        flex: 1, textAlign: 'center', padding: '10px 12px', cursor: 'pointer',
                        borderBottom: activeTab === 'summary' ? '2.5px solid #10b981' : '2.5px solid transparent',
                        fontWeight: activeTab === 'summary' ? 700 : 600,
                        color: activeTab === 'summary' ? '#10b981' : '#94a3b8',
                        background: activeTab === 'summary' ? '#fff' : 'transparent',
                        fontSize: '0.82rem', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                    }}>
                        <Sparkles size={13} /> Summary
                    </div>
                    <div onClick={() => setActiveTab('tasks')} style={{
                        flex: 1, textAlign: 'center', padding: '10px 12px', cursor: 'pointer',
                        borderBottom: activeTab === 'tasks' ? '2.5px solid #f59e0b' : '2.5px solid transparent',
                        fontWeight: activeTab === 'tasks' ? 700 : 600,
                        color: activeTab === 'tasks' ? '#f59e0b' : '#94a3b8',
                        background: activeTab === 'tasks' ? '#fff' : 'transparent',
                        fontSize: '0.82rem', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                    }}>
                        <ClipboardList size={13} /> Tasks {suggestedTasks.length > 0 && <span style={{
                            fontSize: '0.65rem', background: '#fef3c7', color: '#b45309',
                            padding: '1px 6px', borderRadius: '10px', fontWeight: 700
                        }}>{suggestedTasks.length}</span>}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }} className="custom-scrollbar">
                    {meetingName && (
                        <div style={{ 
                            marginBottom: '12px', padding: '8px 12px', 
                            background: '#f8fafc', borderRadius: '10px', 
                            border: '1px solid #e2e8f0', display: 'flex', 
                            alignItems: 'center', gap: '8px' 
                        }}>
                            <div style={{ 
                                width: '28px', height: '28px', borderRadius: '7px', 
                                background: '#fff', border: '1px solid #e2e8f0', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Video size={13} color="#6366f1" />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontSize: '0.58rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Meeting
                                </span>
                                <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {meetingName}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Empty states globally */}
                    {!transcription && !transcribing && !loadingMeeting && meetingTranscriptions.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                            <Mic size={48} style={{ opacity: 0.15, marginBottom: '14px' }} />
                            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                                Upload an audio file to get started
                            </p>
                            <p style={{ fontSize: '0.78rem', marginTop: '4px', color: '#cbd5e1' }}>
                                Transcript, summary & task suggestions will appear here
                            </p>
                        </div>
                    )}

                    {/* Transcribing spinner globally if Transcribing Tab active */}
                    {transcribing && activeTab === 'transcript' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6366f1' }}>
                            <Loader2 size={36} className="animate-spin" style={{ marginBottom: '12px' }} />
                            <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Transcribing audio...</p>
                            <p style={{ fontSize: '0.78rem', marginTop: '4px', color: '#94a3b8' }}>This may take a few minutes</p>
                        </div>
                    )}
                    {transcribing && activeTab !== 'transcript' && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                            <Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                            Currently transcribing... switch to Transcript tab to view progress.
                        </div>
                    )}

                    {/* Transcript Tab Content */}
                    {activeTab === 'transcript' && transcription && !transcribing && (
                        <div style={sectionStyle}>
                            <div style={{ ...labelStyle, justifyContent: 'space-between' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <FileText size={12} /> Transcript
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {transcription.status && (
                                        <span style={{
                                            fontSize: '0.62rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 700,
                                            background: transcription.status === 'Completed' ? '#dcfce7' : transcription.status === 'Failed' ? '#fee2e2' : '#fef9c3',
                                            color: transcription.status === 'Completed' ? '#16a34a' : transcription.status === 'Failed' ? '#dc2626' : '#b45309'
                                        }}>
                                            {transcription.status}
                                        </span>
                                    )}
                                    {transcription.language && (
                                        <span style={{ fontSize: '0.62rem', background: '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>
                                            {transcription.language}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {hasTranscript ? (
                                <div style={{
                                    fontSize: '0.85rem', color: '#334155', lineHeight: '1.7', padding: '12px 14px',
                                    background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {transcription.transcribedText}
                                </div>
                            ) : (
                                <div style={{
                                    padding: '20px', borderRadius: '10px',
                                    background: '#fffbeb', border: '1px solid #fde68a',
                                    fontSize: '0.85rem', color: '#92400e', textAlign: 'center'
                                }}>
                                    <Loader2 size={18} className="animate-spin" style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                                    Processing... Click <b>Reload</b> on the left to check the result.
                                </div>
                            )}
                            {transcription.confidence != null && (
                                <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                                    Confidence: {(transcription.confidence * 100).toFixed(0)}%
                                    {transcription.durationInSeconds > 0 && ` · Duration: ${transcription.durationInSeconds.toFixed(1)}s`}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Summary Tab Content */}
                    {activeTab === 'summary' && (
                        <>
                            {summarizing ? (
                                <div style={{ ...sectionStyle, textAlign: 'center', padding: '24px' }}>
                                    <Loader2 size={24} className="animate-spin" style={{ color: '#10b981', margin: '0 auto 8px' }} />
                                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', margin: 0 }}>Generating summary...</p>
                                </div>
                            ) : editingSummary ? (
                                <div style={{ ...sectionStyle, border: '1px solid #a7f3d0', background: '#f0fdf4' }}>
                                    <div style={{ ...labelStyle, color: '#059669' }}>
                                        <Sparkles size={12} /> Edit Summary
                                    </div>
                                    <textarea
                                        value={editSummaryText}
                                        onChange={e => setEditSummaryText(e.target.value)}
                                        style={{
                                            width: '100%', minHeight: '400px', resize: 'vertical',
                                            fontSize: '0.85rem', color: '#065f46', lineHeight: '1.7',
                                            padding: '12px 14px', background: '#fff', borderRadius: '10px',
                                            border: '1.5px solid #6366f1', fontFamily: 'inherit',
                                            outline: 'none', boxSizing: 'border-box' as const
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={handleCancelEditSummary}
                                            disabled={savingSummary}
                                            style={{
                                                padding: '6px 14px', borderRadius: '8px',
                                                border: '1px solid #e2e8f0', background: '#fff',
                                                color: '#64748b', fontWeight: 700, fontSize: '0.75rem',
                                                cursor: savingSummary ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveSummary}
                                            disabled={savingSummary}
                                            style={{
                                                padding: '6px 14px', borderRadius: '8px', border: 'none',
                                                background: savingSummary ? '#e2e8f0' : '#059669',
                                                color: savingSummary ? '#94a3b8' : '#fff',
                                                fontWeight: 700, fontSize: '0.75rem',
                                                cursor: savingSummary ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '4px'
                                            }}
                                        >
                                            {savingSummary ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : <><Save size={12} /> Save</>}
                                        </button>
                                    </div>
                                </div>
                            ) : hasSummary ? (
                                <div style={{ ...sectionStyle, border: '1px solid #a7f3d0', background: '#f0fdf4' }}>
                                    <div style={{ ...labelStyle, color: '#059669', justifyContent: 'space-between' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Sparkles size={12} /> Summary
                                        </span>
                                        {canEditSummary && (
                                            <button
                                                onClick={handleStartEditSummary}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    background: 'none', border: '1px solid #a7f3d0', borderRadius: '6px',
                                                    padding: '3px 8px', cursor: 'pointer', color: '#059669',
                                                    fontSize: '0.65rem', fontWeight: 700, transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                            >
                                                <Edit3 size={10} /> Edit
                                            </button>
                                        )}
                                    </div>
                                    <div style={{
                                        fontSize: '0.85rem', color: '#065f46', lineHeight: '1.7', padding: '12px 14px',
                                        background: '#fff', borderRadius: '10px', border: '1px solid #a7f3d0',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {summary}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                                    <Sparkles size={32} style={{ opacity: 0.2, margin: '0 auto 10px' }} />
                                    <p style={{ fontSize: '0.85rem' }}>No summary generated yet.</p>
                                    {canEditSummary && (
                                        <button
                                            onClick={handleStartEditSummary}
                                            style={{
                                                marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                padding: '7px 16px', borderRadius: '8px', border: '1px solid #a7f3d0',
                                                background: '#f0fdf4', color: '#059669', fontWeight: 700,
                                                fontSize: '0.78rem', cursor: 'pointer'
                                            }}
                                        >
                                            <Edit3 size={12} /> Write Summary
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Tasks Tab Content */}
                    {activeTab === 'tasks' && (
                        <>
                            {suggesting ? (
                                <div style={{ ...sectionStyle, textAlign: 'center', padding: '24px' }}>
                                    <Loader2 size={24} className="animate-spin" style={{ color: '#f59e0b', margin: '0 auto 8px' }} />
                                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b45309', margin: 0 }}>Suggesting tasks...</p>
                                </div>
                            ) : suggestedTasks.length > 0 ? (
                                <div style={sectionStyle}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '10px' }}>
                                        {suggestedTasks.length} tasks suggested — expand to assign &amp; save
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {suggestedTasks.map((task, idx) => (
                                            <div key={idx} style={{
                                                borderRadius: '10px', border: `1px solid ${task._saved ? '#a7f3d0' : '#e2e8f0'}`,
                                                background: task._saved ? '#f0fdf4' : '#fff',
                                                overflow: 'hidden', transition: 'all 0.2s'
                                            }}>
                                                <div
                                                    onClick={() => !task._saved && toggleTask(idx)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: '10px 12px', cursor: task._saved ? 'default' : 'pointer'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                                        {task._saved
                                                            ? <Check size={14} color="#16a34a" />
                                                            : <Plus size={14} color="#6366f1" />
                                                        }
                                                        <span style={{
                                                            fontSize: '0.82rem', fontWeight: 700,
                                                            color: task._saved ? '#16a34a' : '#1e293b',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                        }}>{task.name}</span>
                                                    </div>
                                                    {!task._saved && (
                                                        task._expanded ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />
                                                    )}
                                                </div>
                                                {task._expanded && !task._saved && (
                                                    <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div>
                                                            <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '3px' }}>Task Name *</label>
                                                            <input value={task.name || ''} onChange={e => updateTaskField(idx, 'name', e.target.value)} style={{ ...inputStyle, padding: '7px 10px' }} />
                                                        </div>
                                                        <div>
                                                            <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '3px' }}>Description</label>
                                                            <textarea value={task.description || ''} onChange={e => updateTaskField(idx, 'description', e.target.value)} style={{ ...inputStyle, minHeight: '48px', resize: 'vertical' }} />
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                                            <div>
                                                                <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '3px' }}>Priority</label>
                                                                <select value={task.priority ?? 2} onChange={e => updateTaskField(idx, 'priority', parseInt(e.target.value))} style={{ ...inputStyle, height: '32px' }}>
                                                                    <option value={1}>Low</option>
                                                                    <option value={2}>Normal</option>
                                                                    <option value={3}>High</option>
                                                                    <option value={4}>Urgent</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '3px' }}>
                                                                    <User size={9} /> Assignee
                                                                </label>
                                                                <select
                                                                    value={task._assigneeId || task.assigneeId || ''}
                                                                    onChange={e => { updateTaskField(idx, '_assigneeId', e.target.value); updateTaskField(idx, 'assigneeId', e.target.value); }}
                                                                    style={{ ...inputStyle, height: '32px' }}
                                                                >
                                                                    <option value="">Unassigned</option>
                                                                    {projectMembers.map(u => (
                                                                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '3px' }}>Start Date</label>
                                                                <input type="date" value={task.startDate ? task.startDate.split('T')[0] : ''} onChange={e => updateTaskField(idx, 'startDate', e.target.value)} style={{ ...inputStyle, height: '32px' }} />
                                                            </div>
                                                            <div>
                                                                <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '3px' }}>Due Date</label>
                                                                <input type="date" value={task.dueDate ? task.dueDate.split('T')[0] : ''} onChange={e => updateTaskField(idx, 'dueDate', e.target.value)} style={{ ...inputStyle, height: '32px' }} />
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleSaveTask(idx)}
                                                            disabled={task._saving}
                                                            style={{
                                                                width: '100%', padding: '7px', borderRadius: '8px', border: 'none',
                                                                background: task._saving ? '#e2e8f0' : '#6366f1',
                                                                color: task._saving ? '#94a3b8' : '#fff',
                                                                cursor: task._saving ? 'not-allowed' : 'pointer',
                                                                fontWeight: 700, fontSize: '0.78rem',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                                                marginTop: '2px'
                                                            }}
                                                        >
                                                            {task._saving
                                                                ? <><Loader2 size={12} className="animate-spin" /> Saving...</>
                                                                : <><Save size={12} /> Create Task</>
                                                            }
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                                    <ClipboardList size={32} style={{ opacity: 0.2, margin: '0 auto 10px' }} />
                                    <p style={{ fontSize: '0.85rem' }}>No tasks suggested yet.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ════════ RIGHT: Meeting Transcriptions List ════════ */}
            {meetingId && meetingTranscriptions.length > 0 && (
                <div style={{
                    flex: '0 0 20%', maxWidth: '20%',
                    display: 'flex', flexDirection: 'column',
                    background: '#fff', borderRadius: '16px',
                    border: '1px solid var(--border-color)', padding: '12px',
                    overflow: 'hidden'
                }}>
                    <div style={{ ...labelStyle, color: '#6366f1', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FileSearch size={11} /> Transcriptions ({meetingTranscriptions.length})
                        </span>
                        <button
                            onClick={() => handleLoadMeetingTranscriptions(false)}
                            disabled={loadingMeeting}
                            style={{ background: 'none', border: 'none', cursor: loadingMeeting ? 'not-allowed' : 'pointer', color: '#6366f1', padding: '2px', display: 'flex', alignItems: 'center' }}
                            title="Refresh"
                        >
                            <RefreshCw size={11} className={loadingMeeting ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '2px', display: 'flex', flexDirection: 'column', gap: '5px' }} className="custom-scrollbar">
                        {loadingMeeting && !meetingTranscriptions.length ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#6366f1' }}>
                                <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                                <p style={{ fontSize: '0.72rem', fontWeight: 600, margin: 0 }}>Loading...</p>
                            </div>
                        ) : meetingTranscriptions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                                No transcriptions found.
                            </div>
                        ) : meetingTranscriptions.map(t => {
                            const isSelected = transcription?.id === t.id;
                            const isFailed = t.status === 'Failed';
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => handleSelectTranscription(t)}
                                    style={{
                                        padding: '8px 10px', borderRadius: '8px',
                                        border: isSelected ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                                        background: isSelected ? '#ede9fe' : isFailed ? '#fef2f2' : '#fff',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                                            {t.fileName || 'Untitled'}
                                        </span>
                                        <span style={{
                                            fontSize: '0.56rem', padding: '1px 6px', borderRadius: '20px', fontWeight: 700, flexShrink: 0, marginLeft: '4px',
                                            background: t.status === 'Completed' ? '#dcfce7' : isFailed ? '#fee2e2' : '#fef9c3',
                                            color: t.status === 'Completed' ? '#16a34a' : isFailed ? '#dc2626' : '#b45309'
                                        }}>
                                            {t.status}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.62rem', color: '#94a3b8', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {t.language && <span>{t.language.toUpperCase()}</span>}
                                        <span>{new Date(t.createdAt).toLocaleString()}</span>
                                    </div>
                                    {isFailed && (
                                        <div style={{ marginTop: '4px', fontSize: '0.65rem', color: '#dc2626', display: 'flex', alignItems: 'flex-start', gap: '3px' }}>
                                            <AlertTriangle size={10} style={{ flexShrink: 0, marginTop: '2px' }} />
                                            <span style={{ lineHeight: '1.4' }}>Click to view error details</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Custom Confirmation Modal */}
            {showConfirmClose && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '20px', padding: '24px',
                        width: '90%', maxWidth: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        textAlign: 'center', animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '16px',
                            background: '#fff7ed', color: '#f97316',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 18px auto', border: '1px solid #ffedd5'
                        }}>
                            <AlertTriangle size={28} />
                        </div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 900, color: '#1e293b' }}>
                            Process in Progress
                        </h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '0.9rem', color: '#64748b', lineHeight: '1.6' }}>
                            AI is currently working on your task. Leaving now will stop the process and you might lose the results. Are you sure?
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowConfirmClose(false)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e2e8f0',
                                    background: '#fff', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                            >
                                No, Stay
                            </button>
                            <button
                                onClick={handleConfirmCloseModal}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.25)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                Yes, Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default TranscriptionPanel;
