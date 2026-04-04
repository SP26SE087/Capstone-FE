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
import Toast, { ToastType } from '@/components/common/Toast';
import {
    Mic, FileAudio, Loader2, ChevronDown, ChevronUp,
    Sparkles, ClipboardList, Plus, Save, X, Check,
    User, FileText, Layers
} from 'lucide-react';

interface TranscriptionPanelProps {
    onClose: () => void;
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

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ onClose }) => {
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Step 1 – Upload & transcribe
    const [models, setModels] = useState<TranscriptionModel[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [language, setLanguage] = useState('vi');
    const [file, setFile] = useState<File | null>(null);
    const [transcribing, setTranscribing] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Step 2 – Transcript result
    const [transcription, setTranscription] = useState<TranscriptionResponse | null>(null);

    // Step 3 – Summary
    const [summarizing, setSummarizing] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);

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
            if (m.length > 0) setSelectedModel(m[0].id || '');
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
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Transcription failed.';
            setToast({ message: msg, type: 'error' });
        } finally {
            setTranscribing(false);
        }
    };

    // ── Summarize ────────────────────────────────────────────────────────────
    const handleSummarize = async () => {
        if (!transcription?.id) return;
        setSummarizing(true);
        try {
            const result = await transcriptionService.summarize(transcription.id);
            if (result.success) {
                setSummary(result.summary);
            } else {
                setToast({ message: result.errorMessage || 'Failed to generate summary.', type: 'error' });
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to generate summary.';
            setToast({ message: msg, type: 'error' });
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
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to suggest tasks.';
            setToast({ message: msg, type: 'error' });
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
            setToast({ message: `Task "${task.name}" created.`, type: 'success' });
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to create task.';
            setToast({ message: msg, type: 'error' });
            setSuggestedTasks(prev => prev.map((t, i) => i === idx ? { ...t, _saving: false } : t));
        }
    };

    const hasTranscript = !!transcription?.transcribedText;
    const hasSummary = !!summary;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '34px', height: '34px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
                    }}>
                        <Mic size={17} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>AI Notes</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                            {(['Upload', 'Transcript', 'Summary', 'Tasks'] as const).map((step, i) => {
                                const reached = i === 0 ? true : i === 1 ? hasTranscript : i === 2 ? hasSummary : suggestedTasks.length > 0;
                                const active = i === 0 ? !hasTranscript : i === 1 ? hasTranscript && !hasSummary : i === 2 ? hasSummary && suggestedTasks.length === 0 : suggestedTasks.length > 0;
                                return (
                                    <React.Fragment key={step}>
                                        <span style={{
                                            fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '20px',
                                            background: active ? '#6366f1' : reached ? '#e0e7ff' : '#f1f5f9',
                                            color: active ? '#fff' : reached ? '#6366f1' : '#94a3b8',
                                            transition: 'all 0.3s'
                                        }}>{step}</span>
                                        {i < 3 && <span style={{ fontSize: '0.55rem', color: '#cbd5e1' }}>›</span>}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    title="Close"
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '32px', height: '32px', borderRadius: '8px',
                        border: '1px solid #e2e8f0', background: '#fff',
                        color: '#94a3b8', cursor: 'pointer', flexShrink: 0,
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                >
                    <X size={15} />
                </button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '2px' }} className="custom-scrollbar">

                {/* ── STEP 1: Upload ─────────────────────────────────────────── */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileAudio size={12} /> Audio to Text</div>

                    {/* File drop zone */}
                    <div
                        onClick={() => fileRef.current?.click()}
                        style={{
                            border: `2px dashed ${file ? '#6366f1' : '#e2e8f0'}`,
                            borderRadius: '10px', padding: '14px 16px',
                            textAlign: 'center', cursor: 'pointer',
                            background: file ? '#f5f3ff' : '#fafafa',
                            marginBottom: '12px', transition: 'all 0.2s'
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
                        <FileAudio size={22} color={file ? '#6366f1' : '#94a3b8'} style={{ marginBottom: '6px' }} />
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: file ? '#6366f1' : '#64748b' }}>
                            {file ? file.name : 'Click to select audio / video file'}
                        </div>
                        {file && (
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                                {(file.size / 1024 / 1024).toFixed(1)} MB
                            </div>
                        )}
                    </div>

                    {/* Model + Language */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '4px' }}>Model</label>
                            <select
                                value={selectedModel}
                                onChange={e => setSelectedModel(e.target.value)}
                                style={{ ...inputStyle, height: '38px' }}
                            >
                                {models.length === 0
                                    ? <option value="">Default</option>
                                    : models.map(m => <option key={m.id || ''} value={m.id || ''}>{m.name || m.id}</option>)
                                }
                            </select>
                        </div>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '4px' }}>Language</label>
                            <select
                                value={language}
                                onChange={e => setLanguage(e.target.value)}
                                style={{ ...inputStyle, height: '38px' }}
                            >
                                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleTranscribe}
                        disabled={!file || transcribing}
                        style={{
                            width: '100%', padding: '9px', borderRadius: '10px', border: 'none',
                            background: !file || transcribing ? '#e2e8f0' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                            color: !file || transcribing ? '#94a3b8' : '#fff',
                            cursor: !file || transcribing ? 'not-allowed' : 'pointer',
                            fontWeight: 700, fontSize: '0.82rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            boxShadow: !file || transcribing ? 'none' : '0 4px 12px rgba(99,102,241,0.25)'
                        }}
                    >
                        {transcribing ? <><Loader2 size={14} className="animate-spin" /> Transcribing...</> : <><Mic size={14} /> Transcribe</>}
                    </button>
                </div>

                {/* ── STEP 2: Transcript result ─────────────────────────────── */}
                {hasTranscript && (
                    <div style={sectionStyle}>
                        <div style={{ ...labelStyle, justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <FileText size={12} /> Transcript
                            </span>
                            {transcription?.language && (
                                <span style={{ fontSize: '0.62rem', background: '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>
                                    {transcription.language}
                                </span>
                            )}
                        </div>
                        <div style={{
                            maxHeight: '180px', overflowY: 'auto', fontSize: '0.82rem',
                            color: '#334155', lineHeight: '1.65', padding: '10px 12px',
                            background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'
                        }} className="custom-scrollbar">
                            {transcription?.transcribedText}
                        </div>
                        {transcription?.confidence != null && (
                            <div style={{ marginTop: '6px', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                                Confidence: {(transcription.confidence * 100).toFixed(0)}%
                                {transcription.durationInSeconds > 0 && ` · Duration: ${transcription.durationInSeconds.toFixed(1)}s`}
                            </div>
                        )}

                        {/* Next step prompt */}
                        {!hasSummary && (
                            <div style={{
                                marginTop: '10px', padding: '8px 12px', borderRadius: '9px',
                                background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                                border: '1px solid #a7f3d0',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', flex: 1 }}>
                                    ✓ Transcription done — generate a summary to continue
                                </span>
                            </div>
                        )}
                        {/* Summarize button */}
                        <button
                            onClick={handleSummarize}
                            disabled={summarizing || hasSummary}
                            style={{
                                marginTop: '10px', width: '100%', padding: '9px', borderRadius: '10px', border: 'none',
                                background: hasSummary ? '#f1f5f9' : summarizing ? '#e2e8f0' : 'linear-gradient(135deg,#10b981,#059669)',
                                color: hasSummary ? '#94a3b8' : summarizing ? '#94a3b8' : '#fff',
                                cursor: hasSummary || summarizing ? 'not-allowed' : 'pointer',
                                fontWeight: 700, fontSize: '0.82rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                boxShadow: hasSummary || summarizing ? 'none' : '0 4px 12px rgba(16,185,129,0.25)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {summarizing
                                ? <><Loader2 size={14} className="animate-spin" /> Generating Summary...</>
                                : hasSummary
                                    ? <><Check size={14} /> Summary Done</>
                                    : <><Sparkles size={14} /> Generate Summary</>
                            }
                        </button>
                    </div>
                )}

                {/* ── STEP 3: Summary ────────────────────────────────────────── */}
                {hasSummary && (
                    <div style={{ ...sectionStyle, border: '1px solid #a7f3d0', background: '#f0fdf4' }}>
                        <div style={{ ...labelStyle, color: '#059669' }}>
                            <Sparkles size={12} /> Summary
                        </div>
                        <div style={{
                            maxHeight: '200px', overflowY: 'auto', fontSize: '0.82rem',
                            color: '#065f46', lineHeight: '1.7', padding: '10px 12px',
                            background: '#fff', borderRadius: '8px', border: '1px solid #a7f3d0',
                            whiteSpace: 'pre-wrap'
                        }} className="custom-scrollbar">
                            {summary}
                        </div>
                        {suggestedTasks.length === 0 && (
                            <div style={{
                                marginTop: '10px', padding: '8px 12px', borderRadius: '9px',
                                background: 'linear-gradient(135deg, #fffbeb, #fef9c3)',
                                border: '1px solid #fde68a',
                                fontSize: '0.75rem', fontWeight: 700, color: '#b45309'
                            }}>
                                ✓ Summary ready — select a project below to suggest tasks
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 4: Suggest Tasks ──────────────────────────────────── */}
                {(hasTranscript || hasSummary) && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><ClipboardList size={12} /> Suggest Tasks</div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                            <div>
                                <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '4px' }}>Project *</label>
                                <select
                                    value={selectedProjectId}
                                    onChange={e => { setSelectedProjectId(e.target.value); setSelectedMilestoneId(''); setSuggestedTasks([]); }}
                                    style={{ ...inputStyle, height: '38px' }}
                                >
                                    <option value="">Select project...</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '4px' }}>Milestone</label>
                                <select
                                    value={selectedMilestoneId}
                                    onChange={e => setSelectedMilestoneId(e.target.value)}
                                    disabled={!selectedProjectId || milestones.length === 0}
                                    style={{ ...inputStyle, height: '38px', background: !selectedProjectId ? '#f8fafc' : '#fff' }}
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
                                width: '100%', padding: '9px', borderRadius: '10px', border: 'none',
                                background: !selectedProjectId || suggesting ? '#e2e8f0' : 'linear-gradient(135deg,#f59e0b,#f97316)',
                                color: !selectedProjectId || suggesting ? '#94a3b8' : '#fff',
                                cursor: !selectedProjectId || suggesting ? 'not-allowed' : 'pointer',
                                fontWeight: 700, fontSize: '0.82rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                boxShadow: !selectedProjectId || suggesting ? 'none' : '0 4px 12px rgba(249,115,22,0.2)'
                            }}
                        >
                            {suggesting ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Layers size={14} /> Suggest Tasks</>}
                        </button>

                        {/* Suggested task list */}
                        {suggestedTasks.length > 0 && (
                            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
                                    {suggestedTasks.length} tasks suggested — expand to assign &amp; save
                                </div>
                                {suggestedTasks.map((task, idx) => (
                                    <div key={idx} style={{
                                        borderRadius: '10px', border: `1px solid ${task._saved ? '#a7f3d0' : '#e2e8f0'}`,
                                        background: task._saved ? '#f0fdf4' : '#fff',
                                        overflow: 'hidden', transition: 'all 0.2s'
                                    }}>
                                        {/* Task header row */}
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

                                        {/* Expanded content */}
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
                        )}
                    </div>
                )}

                {/* Empty state */}
                {!hasTranscript && !transcribing && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                        <Mic size={36} style={{ opacity: 0.2, marginBottom: '10px' }} />
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>Upload an audio file to get started</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TranscriptionPanel;
