import React, { useState } from 'react';
import { CreateRecurringSeminarRequest, DateOfWeek } from '@/types/seminar';
import { PresenterInfo } from '@/types/meeting';
import seminarService from '@/services/seminarService';
import {
    Save,
    Loader2,
    Calendar,
    Clock,
    MapPin,
    Users,
    FileText,
    Plus,
    X,
    Presentation,
    Hash,
    Repeat
} from 'lucide-react';
import AttendeeSelector, { SelectedAttendee } from '@/components/common/AttendeeSelector';

interface CreateSeminarFormProps {
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    projectsMap: Record<string, string>;
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1.5px solid var(--border-color)',
    fontSize: '0.85rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: '#fff'
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
};

const sectionStyle: React.CSSProperties = {
    padding: '16px',
    background: 'var(--background-color)',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    marginBottom: '16px'
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CreateSeminarForm: React.FC<CreateSeminarFormProps> = ({
    onClose,
    onSaved,
    onTitleChange,
    projectsMap
}) => {
    const [saving, setSaving] = useState(false);

    // Core
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [firstSessionStartTime, setFirstSessionStartTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [numberOfWeeks, setNumberOfWeeks] = useState(10);
    const [dayOfWeek, setDayOfWeek] = useState<DateOfWeek>(DateOfWeek.Monday);
    const [projectId, setProjectId] = useState('');
    const [location, setLocation] = useState('');
    const [selectedAttendees, setSelectedAttendees] = useState<SelectedAttendee[]>([]);

    // Presenters
    const [presenters, setPresenters] = useState<PresenterInfo[]>([]);
    const [newPresenterEmail, setNewPresenterEmail] = useState('');
    const [newPresenterName, setNewPresenterName] = useState('');
    const [newPresenterTopic, setNewPresenterTopic] = useState('');

    // Weekly topics
    const [weeklyTopics, setWeeklyTopics] = useState<string[]>([]);
    const [newTopic, setNewTopic] = useState('');

    const addPresenter = () => {
        if (!newPresenterEmail.trim()) return;
        setPresenters([...presenters, {
            email: newPresenterEmail.trim(),
            name: newPresenterName.trim() || null,
            topic: newPresenterTopic.trim() || null
        }]);
        setNewPresenterEmail('');
        setNewPresenterName('');
        setNewPresenterTopic('');
    };

    const removePresenter = (idx: number) => {
        setPresenters(presenters.filter((_, i) => i !== idx));
    };

    const addTopic = () => {
        if (!newTopic.trim()) return;
        setWeeklyTopics([...weeklyTopics, newTopic.trim()]);
        setNewTopic('');
    };

    const removeTopic = (idx: number) => {
        setWeeklyTopics(weeklyTopics.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (!title.trim() || !firstSessionStartTime) return;
        setSaving(true);
        try {
            const req: CreateRecurringSeminarRequest = {
                title: title.trim(),
                description: description.trim() || null,
                firstSessionStartTime: new Date(firstSessionStartTime).toISOString(),
                durationMinutes,
                numberOfWeeks,
                dayOfWeek,
                projectId: projectId || null,
                presenters: presenters.length > 0 ? presenters : null,
                additionalAttendeeEmails: selectedAttendees.length > 0
                    ? selectedAttendees.map(a => a.email)
                    : null,
                location: location.trim() || null,
                weeklyTopics: weeklyTopics.length > 0 ? weeklyTopics : null
            };
            await seminarService.createRecurringSeminar(req);
            onSaved(false, 'Recurring seminar created successfully.');
        } catch (err: any) {
            console.error('Create recurring seminar failed:', err);
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to create recurring seminar.';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Plus size={16} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Create Recurring Seminar
                </h3>
            </div>

            {/* Scrollable Form */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                {/* Basic Info */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> Basic Information</div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Title *</label>
                        <input
                            style={inputStyle}
                            value={title}
                            onChange={e => {
                                setTitle(e.target.value);
                                onTitleChange?.(e.target.value || 'New Seminar');
                            }}
                            placeholder="Seminar series title..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Description</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' as const }}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Seminar description..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><MapPin size={12} /> Location</label>
                            <input
                                style={inputStyle}
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                placeholder="Room, building..."
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><FileText size={12} /> Project</label>
                            <select style={inputStyle} value={projectId} onChange={e => setProjectId(e.target.value)}>
                                <option value="">No Project</option>
                                {Object.entries(projectsMap).map(([id, name]) => (
                                    <option key={id} value={id}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Schedule Config */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Repeat size={12} /> Recurring Schedule</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Calendar size={12} /> First Session *</label>
                            <input
                                type="datetime-local"
                                style={inputStyle}
                                value={firstSessionStartTime}
                                onChange={e => setFirstSessionStartTime(e.target.value)}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Calendar size={12} /> Day of Week</label>
                            <select style={inputStyle} value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}>
                                {dayNames.map((name, idx) => (
                                    <option key={idx} value={idx}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Clock size={12} /> Duration (minutes)</label>
                            <input
                                type="number"
                                style={inputStyle}
                                value={durationMinutes}
                                onChange={e => setDurationMinutes(Number(e.target.value))}
                                min={15}
                                max={480}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Hash size={12} /> Number of Weeks</label>
                            <input
                                type="number"
                                style={inputStyle}
                                value={numberOfWeeks}
                                onChange={e => setNumberOfWeeks(Number(e.target.value))}
                                min={1}
                                max={52}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            />
                        </div>
                    </div>
                </div>

                {/* Presenters */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Presentation size={12} /> Presenter Rotation</div>

                    {presenters.map((p, idx) => (
                        <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: '#fff',
                            border: '1px solid var(--border-light)',
                            marginBottom: '6px'
                        }}>
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name || p.email}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.email}{p.topic ? ` • ${p.topic}` : ''}</div>
                            </div>
                            <button onClick={() => removePresenter(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <input
                            style={{ ...inputStyle, fontSize: '0.8rem', padding: '8px 12px' }}
                            value={newPresenterEmail}
                            onChange={e => setNewPresenterEmail(e.target.value)}
                            placeholder="Email *"
                        />
                        <input
                            style={{ ...inputStyle, fontSize: '0.8rem', padding: '8px 12px' }}
                            value={newPresenterName}
                            onChange={e => setNewPresenterName(e.target.value)}
                            placeholder="Name"
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            style={{ ...inputStyle, fontSize: '0.8rem', padding: '8px 12px', flex: 1 }}
                            value={newPresenterTopic}
                            onChange={e => setNewPresenterTopic(e.target.value)}
                            placeholder="Topic (optional)"
                        />
                        <button
                            onClick={addPresenter}
                            disabled={!newPresenterEmail.trim()}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: newPresenterEmail.trim() ? 'var(--accent-color)' : '#94a3b8',
                                color: '#fff',
                                cursor: newPresenterEmail.trim() ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                flexShrink: 0
                            }}
                        >
                            <Plus size={14} /> Add
                        </button>
                    </div>
                </div>

                {/* Weekly Topics */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> Weekly Topics</div>

                    {weeklyTopics.map((topic, idx) => (
                        <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: '#fff',
                            border: '1px solid var(--border-light)',
                            marginBottom: '4px'
                        }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Week {idx + 1}: {topic}
                            </span>
                            <button onClick={() => removeTopic(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            style={{ ...inputStyle, fontSize: '0.8rem', padding: '8px 12px', flex: 1 }}
                            value={newTopic}
                            onChange={e => setNewTopic(e.target.value)}
                            placeholder={`Week ${weeklyTopics.length + 1} topic...`}
                            onKeyDown={e => e.key === 'Enter' && addTopic()}
                        />
                        <button
                            onClick={addTopic}
                            disabled={!newTopic.trim()}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: newTopic.trim() ? 'var(--accent-color)' : '#94a3b8',
                                color: '#fff',
                                cursor: newTopic.trim() ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                flexShrink: 0
                            }}
                        >
                            <Plus size={14} /> Add
                        </button>
                    </div>
                </div>

                {/* Additional Attendees */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Users size={12} /> Additional Attendees</div>
                    <AttendeeSelector
                        selectedAttendees={selectedAttendees}
                        onChange={setSelectedAttendees}
                        projectsMap={projectsMap}
                    />
                </div>
            </div>

            {/* Footer */}
            <div style={{
                paddingTop: '14px',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: 'auto'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        padding: '8px 20px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: '#fff',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving || !title.trim() || !firstSessionStartTime}
                    style={{
                        padding: '8px 24px',
                        borderRadius: '10px',
                        border: 'none',
                        background: (!title.trim() || !firstSessionStartTime || saving) ? '#94a3b8' : 'var(--accent-color)',
                        color: '#fff',
                        cursor: (!title.trim() || !firstSessionStartTime || saving) ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: (!title.trim() || !firstSessionStartTime || saving) ? 'none' : '0 4px 12px rgba(232,114,12,0.25)'
                    }}
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Create Seminar Series
                </button>
            </div>
        </div>
    );
};

export default CreateSeminarForm;
