import React from 'react';
import { Search, FileText, CheckCircle, Clock, AlertTriangle, FileInput, Plus, Sparkles, Briefcase, ChevronRight } from 'lucide-react';
import { Report } from '@/services/reportService';

interface ReportListProps {
    reports: Report[];
    selectedId: string | null;
    onSelect: (report: Report) => void;
    projectsMap: Record<string, string>;
    usersMap: Record<string, string>;
    getStatusLabel: (status: number) => { label: string, color: string, icon: JSX.Element };
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reports.map((report) => {
                const statusInfo = getStatusLabel(report.status);
                const isSelected = selectedId === report.id;
                const isIndexed = (report as any).hasEmbedding !== false;

                return (
                    <div
                        key={report.id}
                        className="report-card card card-interactive"
                        onClick={() => onSelect(report)}
                        style={{
                            padding: isSplit ? '1rem' : '1.25rem 1.75rem',
                            borderRadius: '16px',
                            border: isSelected ? '2px solid var(--primary-color)' : '1px solid #e2e8f0',
                            backgroundColor: isSelected ? '#f8fafc' : 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: isSplit ? '0.5rem' : '0.85rem',
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
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
                                    {isIndexed && !isSplit && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '2px 6px',
                                            borderRadius: '6px',
                                            background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                                            color: '#0369a1',
                                            fontSize: '0.6rem',
                                            fontWeight: 900,
                                            letterSpacing: '0.05em'
                                        }}>
                                            <Sparkles size={10} /> AI
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
                                                <span style={{ color: '#1e293b', fontWeight: 700 }}>{projectsMap[pId] || 'Collaboration'}</span>
                                            </span>
                                        ) : null;
                                    })()}
                                    {!isSplit && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <FileText size={14} />
                                            Reviewers: <span style={{ color: '#1e293b', fontWeight: 700 }}>
                                                {(() => {
                                                    const r = report as any;
                                                    const members = r.assignees || r.Assignees || r.members || r.Members;
                                                    const ids = r.assigneeIds || r.AssigneeIds || r.memberIds || r.MemberIds;
                                                    const emails = r.assigneeEmails || r.AssigneeEmails || r.memberEmails || r.MemberEmails;

                                                    if (members && Array.isArray(members) && members.length > 0) {
                                                        const getName = (a: any) => a.fullName || a.FullName || a.name || a.Name || a.email || a.Email || 'Member';
                                                        return members.length > 2
                                                            ? members.slice(0, 2).map(getName).join(', ') + ` +${members.length - 2}`
                                                            : members.map(getName).join(', ');
                                                    }

                                                    if (emails && Array.isArray(emails) && emails.length > 0) {
                                                        return emails.length > 2
                                                            ? emails.slice(0, 2).map((e: string) => usersMap[e] || e).join(', ') + ` +${emails.length - 2}`
                                                            : emails.map((e: string) => usersMap[e] || e).join(', ');
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
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.6, fontWeight: 400 }}>
                                {report.description || (report as any).Description || report.goals || (report as any).Goals || 'Documentation in progress for this research entity.'}
                            </p>
                        )}

                        <div style={{
                            borderTop: '1px solid #f1f5f9',
                            paddingTop: isSplit ? '0.75rem' : '1.25rem',
                            marginTop: isSplit ? '0' : '0.25rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: isSplit ? '0.75rem' : '0.85rem',
                            color: '#94a3b8',
                            fontWeight: 600
                        }}>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <span>{report.submitedAt ? new Date(report.submitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Pending'}</span>
                            </div>
                            {!isSplit && (
                                <div style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    View Artifact <ChevronRight size={14} />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ReportList;
