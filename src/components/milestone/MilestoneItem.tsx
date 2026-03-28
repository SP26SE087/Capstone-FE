import React from 'react';
import { Milestone, MilestoneStatus } from '@/types';
import {
    Calendar,
    CheckCircle2,
    AlertCircle,
    Clock,
    ChevronRight,
    MapPin,
    Eye
} from 'lucide-react';

interface MilestoneItemProps {
    milestone: Milestone;
    onClick?: (milestone: Milestone) => void;
    onDetailClick?: (milestone: Milestone) => void;
}

const MilestoneItem: React.FC<MilestoneItemProps> = ({ milestone, onClick, onDetailClick }) => {
    const getStatusStyle = (status: MilestoneStatus) => {
        switch (status) {
            case MilestoneStatus.NotStarted: return { color: '#64748b', bg: '#f1f5f9', label: 'Not Started', icon: <Clock size={16} /> };
            case MilestoneStatus.InProgress: return { color: '#E8720C', bg: '#fff7ed', label: 'In Progress', icon: <div style={{ width: 10, height: 10, background: '#E8720C', borderRadius: '50%', marginRight: 6 }} /> };
            case MilestoneStatus.Completed: return { color: '#10b981', bg: '#ecfdf5', label: 'Completed', icon: <CheckCircle2 size={16} /> };
            case MilestoneStatus.OnHold: return { color: '#f59e0b', bg: '#fffbeb', label: 'On Hold', icon: <AlertCircle size={16} /> };
            case MilestoneStatus.Cancelled: return { color: '#ef4444', bg: '#fef2f2', label: 'Cancelled', icon: <AlertCircle size={16} /> };
            default: return { color: '#64748b', bg: '#f1f5f9', label: 'Not Started', icon: <Clock size={16} /> };
        }
    };

    const statusStyle = getStatusStyle(milestone.status);
    const progress = milestone.progress !== undefined ? milestone.progress : (milestone.status === MilestoneStatus.Completed ? 100 : (milestone.status === MilestoneStatus.InProgress ? 50 : 0));

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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <span>Phase Progress</span>
                        <span style={{ color: statusStyle.color }}>{progress}%</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: `linear-gradient(90deg, #E8720C, #ff8c33)`,
                                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: `0 0 10px rgba(232,114,12,0.4)`
                            }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={12} />
                            <span>{milestone.startDate && !milestone.startDate.startsWith('0001') ? new Date(milestone.startDate).toLocaleDateString('vi-VN') : 'TBD'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={12} />
                            <span>{milestone.dueDate && !milestone.dueDate.startsWith('0001') ? new Date(milestone.dueDate).toLocaleDateString('vi-VN') : 'TBD'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {onDetailClick && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDetailClick(milestone);
                        }}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            background: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary-color)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                        title="View Milestone Tasks"
                        className="detail-btn"
                    >
                        <Eye size={18} />
                    </button>
                )}
                <div style={{ color: '#94a3b8' }}>
                    <ChevronRight size={20} />
                </div>
            </div>
        </div>
    );
};

export default MilestoneItem;
