import React, { useState, useEffect } from 'react';
import { ClipboardList, Loader2, X, Clock, RefreshCw } from 'lucide-react';
import { userService } from '@/services/userService';
import { useToastStore } from '@/store/slices/toastSlice';
import { useAuth } from '@/hooks/useAuth';
import { SystemRoleEnum } from '@/types/enums';
import FaceRecognitionSection from './FaceRecognitionSection';

interface CheckLogPanelProps {
    email: string;
    studentId: string;
    userName: string;
    onClose: () => void;
    onScanFace: (studentId: string, userName: string) => void;
}

const CheckLogPanel: React.FC<CheckLogPanelProps> = ({ email, studentId, userName, onClose, onScanFace }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToastStore();
    const { user } = useAuth();

    const isLabDirector = user?.role === 'Lab Director' ||
        user?.role === 'LabDirector' ||
        Number(user?.role) === SystemRoleEnum.LabDirector;

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await userService.getCheckingLogs(email);
            setLogs(Array.isArray(data) ? data : []);
        } catch {
            addToast('Failed to load checking logs.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (email) fetchLogs();
    }, [email]);

    const formatDateTime = (raw: string) => {
        if (!raw) return '—';
        try {
            return new Date(raw).toLocaleString('vi-VN', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return raw;
        }
    };

    return (
        <div className="card" style={{
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.875rem 1rem',
                borderBottom: '1px solid var(--border-light)',
                background: 'rgba(var(--primary-rgb), 0.01)',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ClipboardList size={15} style={{ color: 'var(--primary-color)' }} />
                    <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                        Check Log
                    </h3>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={fetchLogs}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', padding: '4px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Refresh"
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', padding: '4px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* User info strip */}
            <div style={{
                padding: '0.5rem 1rem',
                background: 'var(--accent-bg)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-light)'
            }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{userName}</span>
                {studentId && <span style={{ marginLeft: '6px', fontWeight: 700, color: 'var(--text-primary)' }}>· ID: {studentId}</span>}
            </div>

            {/* Face Recognition — chỉ hiển thị cho Lab Director */}
            {isLabDirector && (
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)' }}>
                    <FaceRecognitionSection
                        studentId={studentId}
                        userName={userName}
                        onScanFace={onScanFace}
                    />
                </div>
            )}

            {/* Logs list */}
            <div className="custom-scrollbar" style={{
                flex: 1,
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 420px)',
                padding: '0.5rem 0'
            }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                        <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary-color)' }} />
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                        <Clock size={28} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.4 }} />
                        <p style={{ fontSize: '0.78rem', margin: 0 }}>No check logs yet</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {logs.map((log: any, idx: number) => (
                            <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.5rem 1rem',
                                borderBottom: '1px solid var(--border-light)',
                                fontSize: '0.75rem'
                            }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'var(--accent-bg)', color: 'var(--accent-color)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, fontSize: '0.6rem', fontWeight: 700
                                }}>
                                    {logs.length - idx}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {formatDateTime(log.checkingTime || log.CheckingTime || log.time || log.timestamp)}
                                    </div>
                                    {(log.studentId || log.StudentId) && (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                                            ID: {log.studentId || log.StudentId}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckLogPanel;
