import { create } from 'zustand';
import { TranscriptionResponse } from '@/services/transcriptionService';

export type PersistedSuggestedTask = {
    [key: string]: any;
    _expanded: boolean;
    _assigneeId: string;
    _saving: boolean;
    _saved: boolean;
};

interface TranscriptionStoreState {
    // Transcription data
    transcription: TranscriptionResponse | null;
    summary: string | null;
    suggestedTasks: PersistedSuggestedTask[];
    activeTab: 'transcript' | 'summary' | 'tasks';
    selectedProjectId: string;

    // Panel context
    meetingId: string | null;
    meetingName: string | null;
    showPanel: boolean;
    source: 'schedule' | 'seminar' | null;

    // Actions
    setTranscription: (t: TranscriptionResponse | null) => void;
    setSummary: (s: string | null) => void;
    setSuggestedTasks: (tasks: PersistedSuggestedTask[]) => void;
    setActiveTab: (tab: 'transcript' | 'summary' | 'tasks') => void;
    setSelectedProjectId: (id: string) => void;
    /**
     * Set the panel context. Clears transcription data when meetingId changes
     * so stale results from a previous meeting are never shown.
     */
    setPanelContext: (ctx: {
        meetingId: string | null;
        meetingName: string | null;
        showPanel: boolean;
        source: 'schedule' | 'seminar' | null;
    }) => void;
    setShowPanel: (v: boolean) => void;
    /** Fully reset all transcription state */
    clear: () => void;
}

const initialState = {
    transcription: null as TranscriptionResponse | null,
    summary: null as string | null,
    suggestedTasks: [] as PersistedSuggestedTask[],
    activeTab: 'transcript' as 'transcript' | 'summary' | 'tasks',
    selectedProjectId: '',
    meetingId: null as string | null,
    meetingName: null as string | null,
    showPanel: false,
    source: null as 'schedule' | 'seminar' | null,
};

export const useTranscriptionStore = create<TranscriptionStoreState>((set, get) => ({
    ...initialState,

    setTranscription: (t) => set({ transcription: t }),
    setSummary: (s) => set({ summary: s }),
    setSuggestedTasks: (tasks) => set({ suggestedTasks: tasks }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setSelectedProjectId: (id) => set({ selectedProjectId: id }),

    setPanelContext: (ctx) =>
        set((state) => ({
            ...ctx,
            // Clear transcription data if switching to a different meeting
            ...(ctx.meetingId !== state.meetingId
                ? { transcription: null, summary: null, suggestedTasks: [], activeTab: 'transcript' as const, selectedProjectId: '' }
                : {}),
        })),

    setShowPanel: (v) => set({ showPanel: v }),
    clear: () => set(initialState),
}));
