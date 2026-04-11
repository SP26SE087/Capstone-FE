import React from 'react';
import { TaskStatus, Priority } from '@/types';
import {
    Clock, Send, AlertTriangle, Settings, CheckCircle2,
    AlertOctagon, ChevronUp, ChevronDown, Minus
} from 'lucide-react';

export interface StatusStyle {
    color: string;
    bg: string;
    label: string;
    icon: React.ReactNode;
}

export interface PriorityStyle {
    color: string;
    label: string;
    icon: React.ReactNode;
}

export const getStatusStyle = (status: TaskStatus): StatusStyle => {
    switch (status) {
        case TaskStatus.Todo:
            return { color: '#64748b', bg: '#f1f5f9', label: 'To Do', icon: <Clock size={14} /> };
        case TaskStatus.InProgress:
            return { color: '#0ea5e9', bg: '#e0f2fe', label: 'In Progress', icon: <div style={{ width: 8, height: 8, background: '#0ea5e9', borderRadius: '50%' }} /> };
        case TaskStatus.Submitted:
            return { color: '#7c3aed', bg: '#f5f3ff', label: 'Submitted', icon: <Send size={14} /> };
        case TaskStatus.Missed:
            return { color: '#ef4444', bg: '#fef2f2', label: 'Missed', icon: <AlertTriangle size={14} /> };
        case TaskStatus.Adjusting:
            return { color: '#f59e0b', bg: '#fffbeb', label: 'Adjusting', icon: <Settings size={14} /> };
        case TaskStatus.Completed:
            return { color: '#10b981', bg: '#ecfdf5', label: 'Completed', icon: <CheckCircle2 size={14} /> };
        default:
            return { color: '#64748b', bg: '#f1f5f9', label: 'Unknown', icon: <Clock size={14} /> };
    }
};

export const getPriorityStyle = (priority: Priority): PriorityStyle => {
    switch (priority) {
        case Priority.Critical:
            return { color: '#ef4444', label: 'Critical', icon: <AlertOctagon size={14} /> };
        case Priority.High:
            return { color: '#f59e0b', label: 'High', icon: <ChevronUp size={14} /> };
        case Priority.Medium:
            return { color: '#3b82f6', label: 'Medium', icon: <Minus size={14} /> };
        case Priority.Low:
            return { color: '#94a3b8', label: 'Low', icon: <ChevronDown size={14} /> };
        default:
            return { color: '#94a3b8', label: 'Normal', icon: <Minus size={14} /> };
    }
};

export const formatDate = (d?: string | null): string => {
    if (!d || d.startsWith('0001')) return 'N/A';
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
