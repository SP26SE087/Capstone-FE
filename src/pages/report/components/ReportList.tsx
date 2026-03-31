import React from 'react';
import { FileText, Sparkles, Briefcase } from 'lucide-react';
import { Report } from '@/services/reportService';

interface ReportListProps {
    reports: Report[];
    selectedId: string | null;
    onSelect: (report: Report) => void;
    projectsMap: Record<string, string>;
    usersMap: Record<string, string>;
    getStatusLabel: (report: Report) => { label: string, color: string, icon: JSX.Element };
    isSplit: boolean;
}

const ReportList: React.FC<ReportListProps> = ({
    reports,
    selectedId,
    onSelect,
    projectsMap,
    usersMap,
    getStatusLabel,
    isSplit
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {reports.map((report) => {
                const statusInfo = getStatusLabel(report);
                const isSelected = selectedId === report.id;
                const hasEmbedding = (report as any).hasEmbedding === true;

                return (
                    <div
                        key={report.id}
                        className="report-card card card-interactive"
                        onClick={() => onSelect(report)}
                        style={{
                            padding: isSplit ? '0.65rem' : '0.75rem 1rem',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid var(--primary-color)' : '1px solid #e2e8f0',
                            backgroundColor: isSelected ? '#f8fafc' : 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: isSelected ? '0 10px 25px -5px rgba(99, 102, 241, 0.1)' : '0 4px 6px -1px rgba(0,0,0,0.02)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {isSelected && (
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--primary-color)' }} />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h3 style={{
                                        margin: 0,
                                        fontSize: isSplit ? '1rem' : '1.15rem',
                                        color: isSelected ? 'var(--primary-color)' : '#1e293b',
                                        fontWeight: 800,
                                        display: '-webkit-box',
                                        WebkitLineClamp: isSplit ? 1 : 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {report.title || (report as any).Title || 'Untitled Research'}
                                    </h3>
                                    {!isSplit && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            background: hasEmbedding ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : '#f1f5f9',
                                            color: hasEmbedding ? '#166534' : '#64748b',
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.02em',
                                            border: `1px solid ${hasEmbedding ? '#bbf7d0' : '#e2e8f0'}`
                                        }}>
                                            <Sparkles size={12} /> {hasEmbedding ? 'Can Semantic Search' : 'Cannot Semantic Search'}
                                        </div>
                                    )}
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: isSplit ? '10px' : '20px',
                                    fontSize: isSplit ? '0.75rem' : '0.9rem',
                                    color: '#64748b',
                                    flexWrap: 'wrap',
                                    fontWeight: 500
                                }}>
                                    {(() => {
                                        const pId = report.projectId || (report as any).ProjectId;
                                        return pId ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Briefcase size={isSplit ? 12 : 14} />
                                                <span style={{ color: '#1e293b', fontWeight: 700 }}>{projectsMap[pId] || 'No project assigned'}</span>
                                            </span>
                                        ) : <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}><Briefcase size={isSplit ? 12 : 14} /> No project assigned</span>;
                                    })()}
                                    {!isSplit && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '280px' }}>
                                            <FileText size={14} style={{ flexShrink: 0 }} />
                                            <span style={{ flexShrink: 0 }}>Reviewers:</span>
                                            <span style={{ color: '#1e293b', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {(() => {
                                                    const r = report as any;
                                                    const members = r.assignees || r.Assignees || r.members || r.Members;
                                                    const emails = r.assigneeEmails || r.AssigneeEmails || r.memberEmails || r.MemberEmails;

                                                    if (members && Array.isArray(members) && members.length > 0) {
                                                        const getName = (a: any) => a.fullName || a.FullName || a.name || a.Name || a.email || a.Email || 'Member';
                                                        return members.map(getName).join(', ');
                                                    }

                                                    if (emails && Array.isArray(emails) && emails.length > 0) {
                                                        return emails.map((e: string) => usersMap[e] || e).join(', ');
                                                    }

                                                    return 'Individual';
                                                })()}
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: isSplit ? '2px 8px' : '4px 10px',
                                borderRadius: '8px',
                                backgroundColor: isSelected ? 'white' : `${statusInfo.color}10`,
                                color: statusInfo.color,
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                border: `1px solid ${statusInfo.color}25`
                            }}>
                                {statusInfo.icon}
                                {statusInfo.label.toUpperCase()}
                            </div>
                        </div>

                        {!isSplit && (
                            <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.6, fontWeight: 400 }}>
                                    {report.description || (report as any).Description || report.goals || (report as any).Goals || 'Documentation in progress for this research entity.'}
                                </p>
                                {(() => {
                                    const dateStr = report.submitedAt || (report as any).SubmitedAt || report.updateAt || (report as any).UpdateAt || (report as any).createdAt || (report as any).CreatedAt;
                                    if (!dateStr) return null;
                                    const d = new Date(dateStr);
                                    return (
                                        <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                                            <strong style={{ fontWeight: 600, marginRight: '6px', color: '#94a3b8' }}>Submit date:</strong>
                                            {d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </span>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ReportList;
