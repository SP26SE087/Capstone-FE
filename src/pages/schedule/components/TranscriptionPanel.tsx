import React, { useState, useEffect, useRef } from 'react';
import {
    transcriptionService,
    TranscriptionResponse,
    TranscriptionModel,
    TaskSuggestion
} from '@/services/transcriptionService';
import { projectService } from '@/services';
import { milestoneService } from '@/services';
import { taskService } from '@/services/taskService';
import { userService } from '@/services';
import { useToastStore } from '@/store/slices/toastSlice';
import {
    Mic, FileAudio, Loader2, ChevronDown, ChevronUp,
    Sparkles, ClipboardList, Plus, Save, X, Check,
    User, FileText, Layers, RefreshCw, FileSearch, AlertTriangle
} from 'lucide-react';

interface TranscriptionPanelProps {
    onClose: () => void;
    meetingId?: string;
    mode?: 'full' | 'view';
}

const sectionStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '16px',
    marginBottom: '14px'
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 800, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.8px',
    marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px'
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

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ onClose, meetingId, mode = 'full' }) => {
    const isViewMode = mode === 'view';
    const { addToast } = useToastStore();

    // Meeting transcriptions
    const [meetingTranscriptions, setMeetingTranscriptions] = useState<TranscriptionResponse[]>([]);
    const [loadingMeeting, setLoadingMeeting] = useState(false);

    // Step 1 – Upload & transcribe
    const [models, setModels] = useState<TranscriptionModel[]>([]);
    const [selectedModel, setSelectedModel] = useState('gpt-4o-transcribe');
    const [language, setLanguage] = useState('vi');
    const [file, setFile] = useState<File | null>(null);
    const [transcribing, setTranscribing] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Step 2 – Transcript result
    const [transcription, setTranscription] = useState<TranscriptionResponse | null>(null);

    // Step 2b – Reload
    const [reloading, setReloading] = useState(false);

    // Step 3 – Summary
    const [summarizing, setSummarizing] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);
    const [summaryLanguage, setSummaryLanguage] = useState('vi');
    const [summaryLength, setSummaryLength] = useState('medium');
    const [summaryStyle, setSummaryStyle] = useState('paragraph');
    const [customPrompt, setCustomPrompt] = useState('');

    // Step 4 – Suggest tasks
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [milestones, setMilestones] = useState<{ id: string; name: string }[]>([]);
    const [selectedMilestoneId, setSelectedMilestoneId] = useState('');
    const [suggesting, setSuggesting] = useState(false);
    const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTask[]>([]);
    const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
    const [projectMembers, setProjectMembers] = useState<{ id: string; name: string; email: string }[]>([]);

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

    const handleSelectTranscription = (t: TranscriptionResponse) => {
        setTranscription(t);
        if (t.summary) setSummary(t.summary);
        addToast('Transcription loaded.', 'success');
    };

    useEffect(() => {
        if (!selectedProjectId) { setMilestones([]); setSelectedMilestoneId(''); setProjectMembers([]); return; }
        milestoneService.getByProject(selectedProjectId).then((list: any[]) => {
            setMilestones(list.map((m: any) => ({ id: m.milestoneId || m.id, name: m.name || m.title || 'Milestone' })));
        });
        // Load project members via getMilestoneTasks pattern
        projectService.getCurrentMember(selectedProjectId).catch(() => {
            // No dedicated member endpoint — fall back to allUsers
        });
        setProjectMembers(allUsers); // fallback: all users
    }, [selectedProjectId, allUsers]);

    // ── Transcribe ──────────────────────────────────────────────────────────
    const handleTranscribe = async () => {
        if (!file) return;
        setTranscribing(true);
        setTranscription(null);
        setSummary(null);
        setSuggestedTasks([]);
        try {
            const result = await transcriptionService.transcribe(file, selectedModel || undefined, language || undefined);
            setTranscription(result);
            if (result.summary) {
                setSummary(result.summary);
            }
            if (result.transcribedText) {
                addToast('Transcription completed successfully!', 'success');
            } else {
                addToast('Transcription submitted. Use Reload to check progress.', 'warning');
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
        try {
            const list = await transcriptionService.suggestTasks(
                textToUse,
                selectedProjectId,
                selectedMilestoneId || undefined
            );
            setSuggestedTasks(list.map(t => ({ ...t, _expanded: false, _assigneeId: '', _saving: false, _saved: false })));
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

    const updateAssignee = (idx: number, id: string) => {
        setSuggestedTasks(prev => prev.map((t, i) => i === idx ? { ...t, _assigneeId: id } : t));
    };

    const handleSaveTask = async (idx: number) => {
        const task = suggestedTasks[idx];
        setSuggestedTasks(prev => prev.map((t, i) => i === idx ? { ...t, _saving: true } : t));
        try {
            await taskService.create({
                name: task.name,
                description: task.description || '',
                priority: task.priority ?? 2,
                status: 1,
                memberId: task._assigneeId || null,
                projectId: selectedProjectId,
                milestoneId: selectedMilestoneId || null,
                startDate: null,
                dueDate: null
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

    return (
        <div style={{ display: 'flex', gap: '16px', height: '100%' }}>

            {/* ════════ LEFT: AI Notes Controls (30%) ════════ */}
            <div style={{
                flex: '0 0 30%', maxWidth: '30%',
                display: 'flex', flexDirection: 'column',
                background: '#fff', borderRadius: '16px',
                border: '1.5px solid #e0e7ff', padding: '16px',
                boxShadow: '0 4px 20px rgba(99,102,241,0.08)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '30px', height: '30px', borderRadius: '8px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
                        }}>
                            <Mic size={14} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{isViewMode ? 'Transcriptions' : 'AI Notes'}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                {isViewMode ? (
                                    <span style={{
                                        fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px', borderRadius: '20px',
                                        background: '#e0e7ff', color: '#6366f1'
                                    }}>View Only</span>
                                ) : ((['Upload', 'Transcript', 'Summary', 'Tasks'] as const).map((step, i) => {
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
                                            {i < 3 && <span style={{ fontSize: '0.5rem', color: '#cbd5e1' }}>›</span>}
                                        </React.Fragment>
                                    );
                                }))}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
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
                                onClick={handleLoadMeetingTranscriptions}
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
                    {!isViewMode && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><FileAudio size={12} /> Audio File</div>
                        <div
                            onClick={() => fileRef.current?.click()}
                            style={{
                                border: `2px dashed ${file ? '#6366f1' : '#e2e8f0'}`,
                                borderRadius: '10px', padding: '12px 14px',
                                textAlign: 'center', cursor: 'pointer',
                                background: file ? '#f5f3ff' : '#fafafa',
                                marginBottom: '10px', transition: 'all 0.2s'
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                            <div>
                                <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Model</label>
                                <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} style={{ ...inputStyle, height: '34px', fontSize: '0.78rem' }}>
                                    {models.length === 0
                                        ? <option value="">Default</option>
                                        : models.map(m => <option key={m.id || ''} value={m.id || ''}>{m.name || m.id}</option>)
                                    }
                                </select>
                            </div>
                            <div>
                                <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Language</label>
                                <select value={language} onChange={e => setLanguage(e.target.value)} style={{ ...inputStyle, height: '34px', fontSize: '0.78rem' }}>
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
                    )}

                    {/* Reload button when pending */}
                    {!isViewMode && transcription && !hasTranscript && (
                        <div style={sectionStyle}>
                            <div style={{ fontSize: '0.75rem', color: '#92400e', marginBottom: '8px', textAlign: 'center', fontWeight: 600 }}>
                                <Loader2 size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
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
                    {!isViewMode && hasTranscript && (
                        <div style={sectionStyle}>
                            <div style={labelStyle}><Sparkles size={12} /> {hasSummary ? 'Re-generate Summary' : 'Summary'}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                                <div>
                                    <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Language</label>
                                    <select value={summaryLanguage} onChange={e => setSummaryLanguage(e.target.value)} style={{ ...inputStyle, height: '34px', fontSize: '0.78rem' }}>
                                        <option value="vi">Tiếng Việt</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Length</label>
                                    <select value={summaryLength} onChange={e => setSummaryLength(e.target.value)} style={{ ...inputStyle, height: '34px', fontSize: '0.78rem' }}>
                                        <option value="short">Short</option>
                                        <option value="medium">Medium</option>
                                        <option value="long">Long</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Format</label>
                                    <select value={summaryStyle} onChange={e => setSummaryStyle(e.target.value)} style={{ ...inputStyle, height: '34px', fontSize: '0.78rem' }}>
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
                                            ...inputStyle, minHeight: '60px', resize: 'vertical',
                                            fontSize: '0.78rem', fontFamily: 'inherit'
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
                    {!isViewMode && (hasTranscript || hasSummary) && (
                        <div style={sectionStyle}>
                            <div style={labelStyle}><ClipboardList size={12} /> Suggest Tasks</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                                <div>
                                    <label style={{ ...labelStyle, fontSize: '0.6rem', marginBottom: '3px' }}>Project *</label>
                                    <select
                                        value={selectedProjectId}
                                        onChange={e => { setSelectedProjectId(e.target.value); setSelectedMilestoneId(''); setSuggestedTasks([]); }}
                                        style={{ ...inputStyle, height: '34px', fontSize: '0.78rem' }}
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
                                        style={{ ...inputStyle, height: '34px', fontSize: '0.78rem', background: !selectedProjectId ? '#f8fafc' : '#fff' }}
                                    >
                                        <option value="">No milestone</option>
                                        {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={handleSuggest}
                                disabled={!selectedProjectId || suggesting}
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
                                {suggesting ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : <><Layers size={13} /> Suggest Tasks</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ════════ RIGHT: Transcript & Results (70%) ════════ */}
            <div style={{
                flex: '0 0 70%', maxWidth: '70%',
                display: 'flex', flexDirection: 'column',
                background: '#fff', borderRadius: '16px',
                border: '1px solid var(--border-color)', padding: '16px',
                overflow: 'hidden'
            }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '2px' }} className="custom-scrollbar">

                    {/* Meeting transcriptions list */}
                    {meetingTranscriptions.length > 0 && (
                        <div style={{ ...sectionStyle, border: '1px solid #c7d2fe', background: '#f5f3ff' }}>
                            <div style={{ ...labelStyle, color: '#6366f1', justifyContent: 'space-between' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <FileSearch size={12} /> Meeting Transcriptions ({meetingTranscriptions.length})
                                </span>
                                <button
                                    onClick={handleLoadMeetingTranscriptions}
                                    disabled={loadingMeeting}
                                    style={{
                                        background: 'none', border: 'none', cursor: loadingMeeting ? 'not-allowed' : 'pointer',
                                        color: '#6366f1', padding: '2px', display: 'flex', alignItems: 'center'
                                    }}
                                    title="Refresh"
                                >
                                    <RefreshCw size={12} className={loadingMeeting ? 'animate-spin' : ''} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {meetingTranscriptions.map(t => {
                                    const isSelected = transcription?.id === t.id;
                                    const isFailed = t.status === 'Failed';
                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => handleSelectTranscription(t)}
                                            style={{
                                                padding: '10px 12px', borderRadius: '10px',
                                                border: isSelected ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                                                background: isSelected ? '#ede9fe' : isFailed ? '#fef2f2' : '#fff',
                                                cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                                                    {t.fileName || 'Untitled'}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.6rem', padding: '2px 7px', borderRadius: '20px', fontWeight: 700,
                                                    background: t.status === 'Completed' ? '#dcfce7' : isFailed ? '#fee2e2' : '#fef9c3',
                                                    color: t.status === 'Completed' ? '#16a34a' : isFailed ? '#dc2626' : '#b45309'
                                                }}>
                                                    {t.status}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', gap: '10px' }}>
                                                {t.language && <span>{t.language.toUpperCase()}</span>}
                                                {t.durationInSeconds > 0 && <span>{t.durationInSeconds.toFixed(0)}s</span>}
                                                <span>{new Date(t.createdAt).toLocaleString()}</span>
                                            </div>
                                            {isFailed && t.errorMessage && (
                                                <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#dc2626', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                                    <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                    <span style={{ lineHeight: '1.4' }}>{t.errorMessage}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Loading meeting transcriptions */}
                    {loadingMeeting && !meetingTranscriptions.length && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#6366f1' }}>
                            <Loader2 size={28} className="animate-spin" style={{ marginBottom: '10px' }} />
                            <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>Loading meeting transcriptions...</p>
                        </div>
                    )}

                    {/* Empty state */}
                    {!transcription && !transcribing && !loadingMeeting && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                            <Mic size={48} style={{ opacity: 0.15, marginBottom: '14px' }} />
                            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Upload an audio file to get started</p>
                            <p style={{ fontSize: '0.78rem', marginTop: '4px', color: '#cbd5e1' }}>Transcript, summary &amp; task suggestions will appear here</p>
                        </div>
                    )}

                    {/* Transcribing spinner */}
                    {transcribing && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6366f1' }}>
                            <Loader2 size={36} className="animate-spin" style={{ marginBottom: '12px' }} />
                            <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Transcribing audio...</p>
                            <p style={{ fontSize: '0.78rem', marginTop: '4px', color: '#94a3b8' }}>This may take a few minutes</p>
                        </div>
                    )}

                    {/* Transcript section */}
                    {transcription && !transcribing && (
                        <>
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
                                        maxHeight: '300px', overflowY: 'auto', fontSize: '0.85rem',
                                        color: '#334155', lineHeight: '1.7', padding: '12px 14px',
                                        background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0',
                                        whiteSpace: 'pre-wrap'
                                    }} className="custom-scrollbar">
                                        {transcription.transcribedText}
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '20px', borderRadius: '10px',
                                        background: '#fffbeb', border: '1px solid #fde68a',
                                        fontSize: '0.85rem', color: '#92400e', textAlign: 'center'
                                    }}>
                                        <Loader2 size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
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

                            {/* Summary result */}
                            {hasSummary && (
                                <div style={{ ...sectionStyle, border: '1px solid #a7f3d0', background: '#f0fdf4' }}>
                                    <div style={{ ...labelStyle, color: '#059669' }}>
                                        <Sparkles size={12} /> Summary
                                    </div>
                                    <div style={{
                                        maxHeight: '250px', overflowY: 'auto', fontSize: '0.85rem',
                                        color: '#065f46', lineHeight: '1.7', padding: '12px 14px',
                                        background: '#fff', borderRadius: '10px', border: '1px solid #a7f3d0',
                                        whiteSpace: 'pre-wrap'
                                    }} className="custom-scrollbar">
                                        {summary}
                                    </div>
                                </div>
                            )}

                            {/* Summarizing spinner */}
                            {summarizing && (
                                <div style={{ ...sectionStyle, textAlign: 'center', padding: '24px' }}>
                                    <Loader2 size={24} className="animate-spin" style={{ color: '#10b981', marginBottom: '8px' }} />
                                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', margin: 0 }}>Generating summary...</p>
                                </div>
                            )}

                            {/* Suggested tasks */}
                            {suggestedTasks.length > 0 && (
                                <div style={sectionStyle}>
                                    <div style={labelStyle}><ClipboardList size={12} /> Suggested Tasks</div>
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
                                                    <div style={{ padding: '0 12px 12px', borderTop: '1px solid #f1f5f9' }}>
                                                        {task.description && (
                                                            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '8px 0 10px', lineHeight: '1.5' }}>
                                                                {task.description}
                                                            </p>
                                                        )}
                                                        <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '4px' }}>
                                                            <User size={10} /> Assign to
                                                        </label>
                                                        <select
                                                            value={task._assigneeId}
                                                            onChange={e => updateAssignee(idx, e.target.value)}
                                                            style={{ ...inputStyle, height: '36px', marginBottom: '10px' }}
                                                        >
                                                            <option value="">Unassigned</option>
                                                            {projectMembers.map(u => (
                                                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => handleSaveTask(idx)}
                                                            disabled={task._saving}
                                                            style={{
                                                                width: '100%', padding: '7px', borderRadius: '8px', border: 'none',
                                                                background: task._saving ? '#e2e8f0' : '#6366f1',
                                                                color: task._saving ? '#94a3b8' : '#fff',
                                                                cursor: task._saving ? 'not-allowed' : 'pointer',
                                                                fontWeight: 700, fontSize: '0.78rem',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
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
                            )}

                            {/* Suggesting spinner */}
                            {suggesting && (
                                <div style={{ ...sectionStyle, textAlign: 'center', padding: '24px' }}>
                                    <Loader2 size={24} className="animate-spin" style={{ color: '#f59e0b', marginBottom: '8px' }} />
                                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b45309', margin: 0 }}>Suggesting tasks...</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TranscriptionPanel;
