import React from 'react';
import { Milestone, MilestoneStatus } from '@/types';
import {
    Calendar,
    CheckCircle2,
    AlertCircle,
    Clock,
    ChevronRight,
    MapPin
} from 'lucide-react';

interface MilestoneItemProps {
    milestone: Milestone;
    onClick?: (milestone: Milestone) => void;
}

const MilestoneItem: React.FC<MilestoneItemProps> = ({ milestone, onClick }) => {
    const getStatusStyle = (status: MilestoneStatus) => {
        switch (status) {
            case MilestoneStatus.Pending: return { color: '#64748b', bg: '#f1f5f9', label: 'Pending', icon: <Clock size={16} /> };
            case MilestoneStatus.Active: return { color: '#0288d1', bg: '#e1f5fe', label: 'In Progress', icon: <div style={{ width: 10, height: 10, background: '#0288d1', borderRadius: '50%', marginRight: 6 }} /> };
            case MilestoneStatus.Completed: return { color: '#10b981', bg: '#ecfdf5', label: 'Achieved', icon: <CheckCircle2 size={16} /> };
            case MilestoneStatus.Delayed: return { color: '#f59e0b', bg: '#fffbeb', label: 'Delayed', icon: <AlertCircle size={16} /> };
            case MilestoneStatus.Cancelled: return { color: '#ef4444', bg: '#fef2f2', label: 'Cancelled', icon: <AlertCircle size={16} /> };
            default: return { color: '#64748b', bg: '#f1f5f9', label: 'Pending', icon: <Clock size={16} /> };
        }
    };

    const statusStyle = getStatusStyle(milestone.status);
    const progress = milestone.status === MilestoneStatus.Completed ? 100 : (milestone.status === MilestoneStatus.Active ? 50 : 0);

    return (
        <div
            onClick={() => onClick?.(milestone)}
            style={{
                padding: '1.25rem',
                background: 'white',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                position: 'relative',
                overflow: 'hidden'
            }}
            className="milestone-card"
        >
            <div style={{
                width: '12px',
                height: '100%',
                background: statusStyle.color,
                position: 'absolute',
                left: 0,
                top: 0,
                opacity: 0.8
            }} />

            <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: `${statusStyle.color}10`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: statusStyle.color,
                flexShrink: 0
            }}>
                <MapPin size={24} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {milestone.name}
                    </h4>
                    <span style={{
                        fontSize: '0.75rem',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap'
                    }}>
                        {statusStyle.icon}
                        {statusStyle.label}
                    </span>
                </div>

                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {milestone.description || "No description for this research milestone."}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        <span>Due: {new Date(milestone.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div style={{ flex: 1, height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: statusStyle.color, transition: 'width 0.5s ease' }} />
                    </div>
                </div>
            </div>

            <div style={{ color: 'var(--border-color)' }}>
                <ChevronRight size={20} />
            </div>
        </div>
    );
};

export default MilestoneItem;
