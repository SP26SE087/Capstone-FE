import React from 'react';
import { Milestone, MilestoneStatus } from '@/types';
import {
    Calendar,
    CheckCircle2,
    AlertCircle,
    Clock,
    ChevronRight,
    Target,
    Timer
} from 'lucide-react';

interface MilestoneItemProps {
    milestone: Milestone;
    onClick?: (milestone: Milestone) => void;
}

const MilestoneItem: React.FC<MilestoneItemProps> = ({ milestone, onClick }) => {
    const getStatusStyle = (status: MilestoneStatus) => {
        switch (status) {
            case MilestoneStatus.NotStarted: 
                return { color: '#64748b', bg: '#f1f5f9', label: 'NOT STARTED', icon: <Clock size={11} /> };
            case MilestoneStatus.InProgress: 
                return { color: '#0284c7', bg: '#f0f9ff', label: 'IN PROGRESS', icon: <Timer size={11} /> };
            case MilestoneStatus.Completed: 
                return { color: '#10b981', bg: '#f0fdf4', label: 'COMPLETE', icon: <CheckCircle2 size={11} /> };
            case MilestoneStatus.OnHold: 
                return { color: '#f59e0b', bg: '#fffbeb', label: 'DELAY', icon: <AlertCircle size={11} /> };
            case MilestoneStatus.Cancelled: 
                return { color: '#ef4444', bg: '#fef2f2', label: 'CANCEL', icon: <AlertCircle size={11} /> };
            default: 
                return { color: '#94a3b8', bg: '#f1f5f9', label: 'UNKNOWN', icon: <Clock size={11} /> };
        }
    };

    const statusStyle = getStatusStyle(milestone.status);
    const progress = milestone.progress !== undefined ? milestone.progress : (milestone.status === MilestoneStatus.Completed ? 100 : (milestone.status === MilestoneStatus.InProgress ? 50 : 0));

    const formatDate = (date: string | null | undefined) => {
        if (!date || date.startsWith('0001')) return 'TBD';
        return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    // Circular progress SVG logic
    const radius = 28;
    const stroke = 5;
    const circumference = (radius - stroke/2) * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div
            onClick={() => onClick?.(milestone)}
            style={{
                background: 'white',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                padding: '0.85rem 1.25rem',
                gap: '1.25rem',
                position: 'relative',
                boxShadow: 'var(--shadow-xs)',
                overflow: 'hidden',
                minHeight: '100px'
            }}
            className="milestone-card-v2"
        >


            {/* Icon Column */}
            <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${statusStyle.color}12, ${statusStyle.color}05)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: statusStyle.color,
                flexShrink: 0,
                border: `1px solid ${statusStyle.color}15`
            }}>
                <Target size={20} />
            </div>

            {/* Main Content Column */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 220px) auto', alignItems: 'center', gap: '12px' }}>
                        <h4 style={{ 
                            margin: 0, 
                            fontSize: '0.9rem', 
                            fontWeight: 700, 
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }} title={milestone.name}>
                            {milestone.name}
                        </h4>
                        <div style={{
                            fontSize: '0.55rem',
                            padding: '1px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            border: `1px solid ${statusStyle.color}10`,
                            flexShrink: 0,
                            width: 'max-content'
                        }}>
                            {statusStyle.icon}
                            {statusStyle.label}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} />
                            <span>{formatDate(milestone.startDate)} — {formatDate(milestone.dueDate)}</span>
                        </div>
                    </div>
                </div>

                <p style={{ 
                    margin: 0, 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    opacity: 0.7,
                    maxWidth: '90%'
                }}>
                    {milestone.description || <span style={{ fontStyle: 'italic', opacity: 0.4 }}>No description.</span>}
                </p>
            </div>

            {/* Progress Column - Centered Vertically */}
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '8px',
                flexShrink: 0,
                position: 'relative',
                justifyContent: 'center',
                marginRight: '0.5rem',
                minWidth: '80px'
            }}>
                <div style={{ position: 'relative', width: radius * 2, height: radius * 2 }}>
                    <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
                        <circle
                            stroke="var(--border-light)"
                            fill="transparent"
                            strokeWidth={stroke}
                            r={radius - stroke/2}
                            cx={radius}
                            cy={radius}
                        />
                        <circle
                            stroke={statusStyle.color}
                            fill="transparent"
                            strokeDasharray={circumference + ' ' + circumference}
                            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            r={radius - stroke/2}
                            cx={radius}
                            cy={radius}
                        />
                    </svg>
                    <div style={{ 
                        position: 'absolute', 
                        top: '50%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)', 
                        fontSize: '0.95rem', 
                        fontWeight: 900, 
                        color: 'var(--text-primary)' 
                    }}>
                        {progress}%
                    </div>
                </div>
                <span style={{ 
                    textTransform: 'uppercase', 
                    fontSize: '0.7rem', 
                    letterSpacing: '0.05em', 
                    fontWeight: 500, 
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    lineHeight: 1
                }}>Task Progress</span>
            </div>

            {/* Navigation Chevron */}
            <div style={{ 
                color: 'var(--text-muted)',
                opacity: 0.3,
                transition: 'all 0.3s ease',
                flexShrink: 0
            }} className="chevron-indicator">
                <ChevronRight size={18} strokeWidth={3} />
            </div>

            <style>{`
                .milestone-card-v2:hover {
                    border-color: var(--accent-color)22;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
                    transform: translateX(4px);
                    background: #fafafa;
                }
                .milestone-card-v2:hover .chevron-indicator {
                    opacity: 1;
                    color: var(--accent-color);
                    transform: translateX(4px);
                }
            `}</style>
        </div>
    );
};

export default MilestoneItem;

