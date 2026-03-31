import React from 'react';
import { X, Check, MessageSquare } from 'lucide-react';
import { Report } from '@/services/reportService';

interface FeedbackSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    report: Report | null;
}

const FeedbackSidebar: React.FC<FeedbackSidebarProps> = ({ isOpen, onClose, report }) => {
    if (!isOpen) return null;

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
            {/* Backdrop */}
            <div 
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)', pointerEvents: 'auto' }}
                onClick={onClose}
            />
            {/* Sidebar Box */}
            <div 
                style={{ 
                    position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '350px', 
                    background: '#fff', boxShadow: '-10px 0 40px rgba(0,0,0,0.1)',
                    display: 'flex', flexDirection: 'column', pointerEvents: 'auto',
                    borderLeft: '1px solid #e2e8f0'
                }}
            >
                <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={18} color="var(--primary-color)" /> Reviewer Feedback
                    </h3>
                    <button onClick={onClose} style={{ border: 'none', background: '#f8fafc', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}>
                        <X size={18} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem', backgroundColor: '#fcfdfe' }} className="custom-scrollbar-thin">
                    {(() => {
                        const reviewList = (report as any)?.assignees || (report as any)?.Assignees || [];
                        const feedbackList = reviewList.filter((r: any) => r.status > 1 || r.feedback);
                        
                        if (feedbackList.length === 0) {
                            return <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '3rem', fontSize: '0.9rem' }}>No feedback available yet.</div>;
                        }

                        return feedbackList.map((rev: any, idx: number) => {
                            const isApproved = rev.status === 2;
                            const isRejected = rev.status === 3;
                            const color = isApproved ? '#10b981' : (isRejected ? '#ef4444' : '#64748b');
                            const bg = isApproved ? '#ecfdf5' : (isRejected ? '#fef2f2' : '#f8fafc');
                            const statusLabel = isApproved ? 'Approved' : (isRejected ? 'Rejected' : 'Reviewing');

                            return (
                                <div key={idx} style={{ marginBottom: '1.5rem', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f8fafc', border: '1px solid #f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800 }}>
                                                {rev.fullName?.[0] || 'U'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>{rev.fullName || 'Reviewer'}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{rev.email}</div>
                                            </div>
                                        </div>
                                        <div style={{ padding: '6px 10px', borderRadius: '8px', background: bg, color: color, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {isApproved && <Check size={12} />}
                                            {isRejected && <X size={12} />}
                                            {statusLabel}
                                        </div>
                                    </div>
                                    {rev.feedback ? (
                                        <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', borderLeft: `4px solid ${color}` }}>
                                            {rev.feedback}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '10px' }}>No written feedback provided.</div>
                                    )}
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>
        </div>
    );
};

export default FeedbackSidebar;
