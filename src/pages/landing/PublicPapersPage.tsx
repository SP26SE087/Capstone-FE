import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BookOpen, Building2, Calendar, Eye, ExternalLink, FileText,
    Presentation, Search, User, Users, X,
} from 'lucide-react';
import { paperSubmissionService } from '@/services/paperSubmissionService';
import { SubmissionStatus, SubmissionStatusLabel, type PaperSubmissionResponse } from '@/types/paperSubmission';
import logo from '@/assets/aita.png';

const PAGE_SIZE = 100;

const statusStyleMap: Partial<Record<SubmissionStatus, { color: string; bg: string }>> = {
    [SubmissionStatus.Accepted]:  { color: '#047857', bg: '#d1fae5' },
    [SubmissionStatus.Published]: { color: '#166534', bg: '#dcfce7' },
    [SubmissionStatus.Submitted]: { color: '#1d4ed8', bg: '#dbeafe' },
    [SubmissionStatus.Approved]:  { color: '#166534', bg: '#dcfce7' },
    [SubmissionStatus.Rejected]:  { color: '#b91c1c', bg: '#fee2e2' },
};
const getStatusStyle = (s: SubmissionStatus) => statusStyleMap[s] ?? { color: '#475569', bg: '#f1f5f9' };

const formatDate = (v?: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const getDocViewerUrl = (url: string): { viewerUrl: string; kind: 'pdf' | 'office' | 'link' } => {
    const clean = url.split('?')[0].split('#')[0];
    const ext = clean.split('.').pop()?.toLowerCase() ?? '';
    if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext))
        return { viewerUrl: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`, kind: 'office' };
    if (ext === 'pdf')
        return { viewerUrl: url, kind: 'pdf' };
    return { viewerUrl: url, kind: 'link' };
};

// ─── Paper Row ────────────────────────────────────────────────────────────────
interface PaperRowProps {
    paper: PaperSubmissionResponse;
    isSelected: boolean;
    onSelect: () => void;
}

const PaperRow: React.FC<PaperRowProps> = ({ paper, isSelected, onSelect }) => {
    const [hovered, setHovered] = useState(false);
    const ss = getStatusStyle(paper.status);
    const hasDoc = !!(paper.document || paper.paperUrl);

    return (
        <div
            onClick={onSelect}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '10px 13px',
                borderRadius: '9px',
                background: isSelected ? '#f8fafc' : hovered ? '#f8fafc' : '#fff',
                border: `1px solid ${isSelected ? '#cbd5e1' : hovered ? '#e2e8f0' : 'transparent'}`,
                borderLeft: `3px solid ${isSelected ? '#1e293b' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.12s',
                display: 'flex', flexDirection: 'column', gap: '4px',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.35, flex: 1, minWidth: 0 }}>
                    {paper.title}
                </span>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: ss.color, background: ss.bg, padding: '1px 7px', borderRadius: '999px' }}>
                        {SubmissionStatusLabel[paper.status] ?? 'Unknown'}
                    </span>
                    {hasDoc && <Eye size={11} color="#94a3b8" />}
                </div>
            </div>
            {paper.conferenceName && (
                <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>{paper.conferenceName}</div>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: '#94a3b8' }}>
                    <User size={10} /> {paper.creatorFullName || paper.creatorEmail || 'Unknown'}
                </span>
                {paper.submissionDeadline && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: '#94a3b8' }}>
                        <Calendar size={10} /> {formatDate(paper.submissionDeadline)}
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── Section Label ────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{
        fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
    }}>
        {children}
    </div>
);

// ─── Info Cell ────────────────────────────────────────────────────────────────
const InfoCell: React.FC<{ icon: React.ReactNode; label: string; fullWidth?: boolean; children: React.ReactNode }> = ({ icon, label, fullWidth, children }) => (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>{icon}{children}</span>
    </div>
);

// ─── Detail Panel ─────────────────────────────────────────────────────────────
interface DetailPanelProps {
    paper: PaperSubmissionResponse;
    onClose: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ paper, onClose }) => {
    const [showViewer, setShowViewer] = useState(false);
    const ss = getStatusStyle(paper.status);
    const docUrl = paper.document || null;
    const docViewer = docUrl ? getDocViewerUrl(docUrl) : null;

    React.useEffect(() => { setShowViewer(false); }, [paper.paperSubmissionId]);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            height: '100%', overflow: 'hidden',
            background: '#fff', borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px -4px rgba(30,41,59,0.1)',
            animation: 'pubPanelIn 0.18s cubic-bezier(0,0,0.2,1) both',
        }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.1rem 0.85rem', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.6rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '5px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: ss.color, background: ss.bg, padding: '1px 7px', borderRadius: '999px' }}>
                                {SubmissionStatusLabel[paper.status] ?? 'Unknown'}
                            </span>
                            {paper.projectName && (
                                <>
                                    <span style={{ color: '#cbd5e1' }}>·</span>
                                    <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600 }}>{paper.projectName}</span>
                                </>
                            )}
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.4 }}>
                            {paper.title}
                        </h2>
                        {paper.conferenceName && (
                            <div style={{ marginTop: '3px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{paper.conferenceName}</div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            flexShrink: 0, width: '28px', height: '28px', borderRadius: '7px',
                            border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8',
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.1rem 1.2rem' }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Meta grid */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem 1rem', padding: '0.7rem 0.85rem',
                        background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0',
                    }}>
                        <InfoCell icon={<User size={12} color="#94a3b8" />} label="Author">
                            {paper.creatorFullName || paper.creatorEmail || '—'}
                        </InfoCell>
                        {paper.submissionDeadline && (
                            <InfoCell icon={<Calendar size={12} color="#94a3b8" />} label="Deadline">
                                {formatDate(paper.submissionDeadline) ?? '—'}
                            </InfoCell>
                        )}
                        {paper.projectName && (
                            <InfoCell icon={<Building2 size={12} color="#94a3b8" />} label="Project" fullWidth>
                                {paper.projectName}
                            </InfoCell>
                        )}
                    </div>

                    {/* Abstract */}
                    {paper.abstract && (
                        <div>
                            <SectionLabel>Abstract</SectionLabel>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.7 }}>
                                {paper.abstract}
                            </p>
                        </div>
                    )}

                    {/* Assignees */}
                    {(paper.assignees ?? []).length > 0 && (
                        <div>
                            <SectionLabel>Assignees</SectionLabel>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {(paper.assignees ?? []).map(a => (
                                    <span key={a.userId} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '3px 10px', borderRadius: '999px',
                                        background: '#f1f5f9', border: '1px solid #e2e8f0',
                                        fontSize: '0.75rem', fontWeight: 600, color: '#334155',
                                    }}>
                                        <Users size={10} color="#94a3b8" /> {a.fullName || a.email}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* External Users */}
                    {(paper.externalUsers ?? []).length > 0 && (
                        <div>
                            <SectionLabel>External Authors</SectionLabel>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {(paper.externalUsers ?? []).map(eu => (
                                    <div key={eu.externalUserId} style={{
                                        padding: '6px 10px', borderRadius: '8px',
                                        background: '#fffbeb', border: '1px solid #fde68a',
                                        fontSize: '0.78rem', color: '#78350f', fontWeight: 600,
                                    }}>
                                        {eu.fullName || eu.email || '—'}
                                        {eu.email && eu.fullName && (
                                            <span style={{ fontWeight: 400, color: '#92400e', marginLeft: '6px', fontSize: '0.71rem' }}>{eu.email}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resources */}
                    {(paper.paperUrl || docUrl) && (
                        <div>
                            <SectionLabel>Resources</SectionLabel>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {paper.paperUrl && (
                                    <a
                                        href={paper.paperUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '0.55rem 0.8rem', borderRadius: '9px',
                                            background: '#f8fafc', border: '1px solid #e2e8f0',
                                            textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem', color: '#374151',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                                        onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#475569' }}>
                                            <ExternalLink size={14} /> View Paper (External)
                                        </span>
                                        <ExternalLink size={12} color="#94a3b8" />
                                    </a>
                                )}

                                {docUrl && docViewer && (
                                    <button
                                        type="button"
                                        onClick={() => setShowViewer(v => !v)}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '0.55rem 0.8rem', borderRadius: '9px',
                                            background: showViewer ? '#eff6ff' : '#f8fafc',
                                            border: `1px solid ${showViewer ? '#bfdbfe' : '#e2e8f0'}`,
                                            cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                                            color: showViewer ? '#1d4ed8' : '#374151',
                                            transition: 'all 0.15s', textAlign: 'left',
                                        }}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                            <FileText size={14} /> {showViewer ? 'Hide Document' : 'View Document'}
                                        </span>
                                        <Eye size={12} color="#94a3b8" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Inline Document Viewer */}
                    {showViewer && docUrl && docViewer && (
                        <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            {docViewer.kind === 'link' ? (
                                <div style={{ padding: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
                                    Preview unavailable for this file type.{' '}
                                    <a href={docUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>
                                        Open in new tab
                                    </a>
                                </div>
                            ) : (
                                <iframe
                                    src={docViewer.viewerUrl}
                                    style={{ width: '100%', height: '520px', border: 'none', display: 'block' }}
                                    title="Document Viewer"
                                />
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
type FilterType = '' | 'accepted' | 'published' | 'hasdoc';

const PublicPapersPage: React.FC = () => {
    const [papers, setPapers] = useState<PaperSubmissionResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('');
    const [selectedPaper, setSelectedPaper] = useState<PaperSubmissionResponse | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await paperSubmissionService.getPublic({ pageIndex: 1, pageSize: PAGE_SIZE });
                setPapers(Array.isArray(data.items) ? data.items : []);
            } catch (err: any) {
                setError(err?.response?.data?.message || 'Unable to load public papers right now.');
                setPapers([]);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedPaper(null); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const stats = useMemo(() => ({
        total: papers.length,
        accepted: papers.filter(p => p.status === SubmissionStatus.Accepted).length,
        published: papers.filter(p => p.status === SubmissionStatus.Published).length,
        hasdoc: papers.filter(p => !!(p.document || p.paperUrl)).length,
    }), [papers]);

    const filtered = useMemo(() => {
        let result = papers;
        if (activeFilter === 'accepted')  result = result.filter(p => p.status === SubmissionStatus.Accepted);
        if (activeFilter === 'published') result = result.filter(p => p.status === SubmissionStatus.Published);
        if (activeFilter === 'hasdoc')    result = result.filter(p => !!(p.document || p.paperUrl));
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.title?.toLowerCase().includes(q) ||
                p.abstract?.toLowerCase().includes(q) ||
                p.conferenceName?.toLowerCase().includes(q) ||
                (p.creatorFullName || '').toLowerCase().includes(q) ||
                (p.creatorEmail || '').toLowerCase().includes(q) ||
                (p.projectName || '').toLowerCase().includes(q) ||
                (p.assignees ?? []).some(a => (a.fullName || a.email || '').toLowerCase().includes(q))
            );
        }
        return result;
    }, [papers, searchQuery, activeFilter]);

    const clearFilters = () => { setSearchQuery(''); setActiveFilter(''); };
    const hasActiveFilter = !!searchQuery || !!activeFilter;
    const panelOpen = !!selectedPaper;

    const FILTERS: { key: FilterType; label: string; count: number }[] = [
        { key: 'accepted',  label: 'Accepted',     count: stats.accepted },
        { key: 'published', label: 'Published',    count: stats.published },
        { key: 'hasdoc',    label: 'Has Document', count: stats.hasdoc },
    ];

    return (
        <>
            <style>{`
                @keyframes pubSpin    { to { transform: rotate(360deg); } }
                @keyframes pubPanelIn { from{opacity:0;transform:translateX(12px);}to{opacity:1;transform:translateX(0);} }
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>

            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)',
                fontFamily: 'Be Vietnam Pro, system-ui, sans-serif',
            }}>
                {/* Navbar */}
                <nav style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    height: '60px', padding: '0 2rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid #e2e8f0',
                }}>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', color: 'inherit' }}>
                        <img src={logo} alt="AiTaLab" style={{ width: 30, height: 30 }} />
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#15243a' }}>
                            AiTaLab <em style={{ fontStyle: 'normal', color: '#e8720c' }}>LabSync</em>
                        </span>
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Link to="/public/seminars" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem',
                            color: '#64748b', padding: '0.35rem 0.8rem', borderRadius: '7px',
                        }}>
                            <Presentation size={13} /> Seminars
                        </Link>
                        <Link to="/public/papers" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem',
                            color: '#1e293b', background: '#f1f5f9', border: '1px solid #e2e8f0',
                            padding: '0.35rem 0.8rem', borderRadius: '7px',
                        }}>
                            <BookOpen size={13} /> Papers
                        </Link>
                        <Link to="/login" style={{
                            textDecoration: 'none', background: '#1e293b',
                            color: '#fff', padding: '0.38rem 1rem', borderRadius: '7px',
                            fontWeight: 700, fontSize: '0.82rem',
                        }}>Sign In</Link>
                    </div>
                </nav>

                <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.75rem 1.5rem 3rem' }}>
                    {/* Page header */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
                            Public Papers
                        </h1>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                            Published and shared research from LabSync projects.
                            {panelOpen && (
                                <span style={{ color: '#475569' }}> Click another paper to switch · Esc to close.</span>
                            )}
                        </p>
                    </div>

                    {/* Search + filter bar (sticky) */}
                    {!loading && !error && papers.length > 0 && (
                        <div style={{
                            background: '#fff', border: '1px solid #e2e8f0',
                            borderRadius: '12px', padding: '0.7rem 0.9rem',
                            marginBottom: '1.1rem',
                            position: 'sticky', top: '66px', zIndex: 50,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}>
                            <div style={{ position: 'relative', marginBottom: '0.55rem' }}>
                                <Search size={14} style={{
                                    position: 'absolute', left: '11px', top: '50%',
                                    transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none',
                                }} />
                                <input
                                    type="text"
                                    placeholder="Search by title, conference, author, project..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        height: '36px', paddingLeft: '34px', paddingRight: searchQuery ? '34px' : '10px',
                                        border: '1px solid #e2e8f0', borderRadius: '8px',
                                        background: '#f8fafc', fontSize: '0.84rem', fontFamily: 'inherit',
                                        color: '#1e293b', outline: 'none',
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        style={{
                                            position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                                            display: 'flex', alignItems: 'center', padding: 0,
                                        }}
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                {FILTERS.map(({ key, label, count }) => {
                                    const isActive = activeFilter === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setActiveFilter(isActive ? '' : key)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                padding: '4px 10px', borderRadius: '7px', cursor: 'pointer',
                                                fontSize: '0.75rem', fontWeight: 600,
                                                border: `1px solid ${isActive ? '#94a3b8' : '#e2e8f0'}`,
                                                background: isActive ? '#1e293b' : '#f8fafc',
                                                color: isActive ? '#fff' : '#475569',
                                                transition: 'all 0.12s',
                                            }}
                                        >
                                            {label}
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isActive ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                                {hasActiveFilter && (
                                    <button
                                        onClick={clearFilters}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            padding: '4px 10px', borderRadius: '7px', cursor: 'pointer',
                                            fontSize: '0.75rem', fontWeight: 600, marginLeft: 'auto',
                                            border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b',
                                        }}
                                    >
                                        <X size={11} /> Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                            <div style={{
                                width: '24px', height: '24px',
                                border: '2px solid #e2e8f0', borderTopColor: '#64748b',
                                borderRadius: '50%', animation: 'pubSpin 0.7s linear infinite',
                            }} />
                        </div>
                    )}

                    {/* Error */}
                    {!loading && error && (
                        <div style={{
                            border: '1px solid #fecaca', background: '#fef2f2',
                            color: '#b91c1c', padding: '0.85rem 1rem',
                            borderRadius: '10px', fontSize: '0.84rem', fontWeight: 600,
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Empty (no papers at all) */}
                    {!loading && !error && papers.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                            <BookOpen size={40} style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.2 }} />
                            <p style={{ margin: '0 0 4px', fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>No Public Papers Yet</p>
                            <p style={{ margin: 0, fontSize: '0.82rem' }}>Check back soon.</p>
                        </div>
                    )}

                    {/* No results from search/filter */}
                    {!loading && !error && papers.length > 0 && filtered.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#94a3b8' }}>
                            <Search size={32} style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.2 }} />
                            <p style={{ margin: '0 0 12px', fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>No papers match your search.</p>
                            <button
                                onClick={clearFilters}
                                style={{
                                    padding: '5px 14px', borderRadius: '7px', cursor: 'pointer',
                                    border: '1px solid #e2e8f0', background: '#f8fafc',
                                    color: '#475569', fontWeight: 600, fontSize: '0.8rem',
                                }}
                            >
                                Clear filters
                            </button>
                        </div>
                    )}

                    {/* 50/50 split */}
                    {!loading && !error && filtered.length > 0 && (
                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                            {/* Left — list */}
                            <div style={{ flex: '1 1 0', minWidth: 0 }}>
                                <div style={{
                                    fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8',
                                    letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px',
                                }}>
                                    {filtered.length} paper{filtered.length !== 1 ? 's' : ''}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {filtered.map(p => (
                                        <PaperRow
                                            key={p.paperSubmissionId}
                                            paper={p}
                                            isSelected={selectedPaper?.paperSubmissionId === p.paperSubmissionId}
                                            onSelect={() => setSelectedPaper(prev =>
                                                prev?.paperSubmissionId === p.paperSubmissionId ? null : p
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Right — sticky detail panel */}
                            <div style={{
                                flex: '1 1 0', minWidth: 0,
                                position: 'sticky', top: '76px',
                                maxHeight: 'calc(100vh - 96px)',
                                display: 'flex', flexDirection: 'column',
                            }}>
                                {panelOpen ? (
                                    <DetailPanel paper={selectedPaper!} onClose={() => setSelectedPaper(null)} />
                                ) : (
                                    <div style={{
                                        flex: 1, display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center',
                                        border: '2px dashed #e2e8f0', borderRadius: '12px',
                                        padding: '3rem', textAlign: 'center', minHeight: '280px',
                                    }}>
                                        <BookOpen size={32} style={{ marginBottom: '0.65rem', opacity: 0.15 }} />
                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                                            Select a paper to view details
                                        </p>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
                                            Click any paper row on the left
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default PublicPapersPage;
