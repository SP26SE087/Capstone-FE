import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '@/components/common/Modal';
import { Camera, ShieldCheck, Play, Square } from 'lucide-react';
import { faceService } from '@/services/faceService';
import { userService } from '@/services/userService';
import { useToastStore } from '@/store/slices/toastSlice';

interface FaceScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialStudentId: string;
    userName: string;
}

const FACE_VIDEO_FEED = '/face/video_feed';

const FaceScannerModal: React.FC<FaceScannerModalProps> = ({ isOpen, onClose, initialStudentId, userName }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
    const { addToast } = useToastStore();

    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const scanStartTimeRef = useRef<number>(0);
    const isAutoStoppingRef = useRef(false);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            stopPolling();
            setIsScanning(false);
            setStatus(null);
            setVideoSrc(undefined);
            isAutoStoppingRef.current = false;
        }
    }, [isOpen, stopPolling]);

    const executeStop = useCallback(async () => {
        stopPolling();
        setStatus('Saving data...');
        try {
            await faceService.stopAddUser();
            setIsScanning(false);
            setStatus(null);
            setVideoSrc(undefined);

            try {
                const userData = await userService.getByStudentId(initialStudentId);
                const userId = userData?.userId || userData?.id;
                if (userId) {
                    await userService.updateUser(userId, { isActive: true });
                    addToast('Biometric registered. Account activated successfully.', 'success');
                } else {
                    addToast('Biometric saved. Could not activate account: user not found.', 'error');
                }
            } catch (updateErr) {
                console.error('Failed to activate user account:', updateErr);
                addToast('Biometric saved but failed to activate account.', 'error');
            }
        } catch (err) {
            console.error('Stop scan failed:', err);
            setIsScanning(false);
            setStatus(null);
            addToast((err as any).message || 'Failed to stop biometric registration.', 'error');
        }
    }, [stopPolling, initialStudentId, addToast]);

    const startPolling = useCallback((email: string, startTime: number) => {
        pollIntervalRef.current = setInterval(async () => {
            if (isAutoStoppingRef.current) return;
            try {
                const logs = await userService.getCheckingLogs(email);
                const hasNewLog = logs.some((log: any) => {
                    const t = new Date(log.checkingTime ?? log.createdAt ?? log.timestamp).getTime();
                    return t > startTime;
                });
                if (hasNewLog) {
                    isAutoStoppingRef.current = true;
                    await executeStop();
                }
            } catch {
                // silently ignore poll errors to avoid flooding toasts
            }
        }, 3000);
    }, [executeStop]);

    const handleStart = async () => {
        const studentId = String(initialStudentId || '').trim();
        if (!studentId) {
            alert('Student ID is missing.');
            return;
        }
        setIsScanning(true);
        setStatus('Connecting to Biometric Engine...');
        setVideoSrc(`${FACE_VIDEO_FEED}?t=${Date.now()}`);

        try {
            const [userData, startData] = await Promise.all([
                userService.getByStudentId(studentId),
                faceService.startAddUser(studentId),
            ]);

            setStatus(startData.message || 'Scanning... Hold still.');

            const email = userData?.email;
            if (email) {
                scanStartTimeRef.current = Date.now();
                isAutoStoppingRef.current = false;
                startPolling(email, scanStartTimeRef.current);
            }
        } catch (err) {
            console.error('Start scan failed:', err);
            setStatus('Connection failed. Is the Biometric BE running?');
            setIsScanning(false);
            setVideoSrc(undefined);
            addToast((err as any).message || 'Failed to start biometric registration.', 'error');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Biometric Registration"
            maxWidth="500px"
            disableBackdropClose
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '60px', height: '60px', borderRadius: '50%',
                        background: 'var(--accent-bg)', color: 'var(--accent-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem'
                    }}>
                        <ShieldCheck size={32} />
                    </div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Face Recognition Setup</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Register biometrics for <strong>{userName}</strong>
                        {initialStudentId && <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>({initialStudentId})</span>}
                    </p>
                </div>

                <div style={{
                    minHeight: '200px',
                    background: isScanning ? 'var(--primary-color)' : '#f8fafc',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {videoSrc && (
                        <img
                            src={videoSrc}
                            alt="Camera Stream"
                            style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                zIndex: 0
                            }}
                        />
                    )}
                    {isScanning ? (
                        <>
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 0, 0, 0.3)',
                                zIndex: 1
                            }} />
                            <div className="animate-spin" style={{
                                width: '100px', height: '100px', borderRadius: '50%',
                                border: '3px solid rgba(255, 255, 255, 0.1)',
                                borderTopColor: 'var(--accent-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 2
                            }}>
                                <Camera size={40} className="animate-pulse" style={{ color: 'white' }} />
                            </div>
                            <div style={{ textAlign: 'center', color: 'white', zIndex: 2 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>SCANNING...</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{status}</div>
                            </div>
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                background: 'var(--accent-color)',
                                animation: 'scanLine 2s infinite linear',
                                boxShadow: '0 0 15px var(--accent-color)',
                                zIndex: 3
                            }} />
                        </>
                    ) : (
                        <div style={{
                            zIndex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            background: 'rgba(0,0,0,0.35)',
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <Camera size={24} style={{ color: 'white', opacity: 0.6, marginBottom: '0.5rem' }} />
                            <p style={{ color: 'white', fontSize: '0.75rem', margin: 0, fontWeight: 500 }}>
                                Press Start to begin registration.
                            </p>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    {!isScanning ? (
                        <button
                            className="btn btn-primary"
                            onClick={handleStart}
                            style={{ flex: 1, height: '48px', gap: '10px' }}
                        >
                            <Play size={18} /> Start Registration
                        </button>
                    ) : (
                        <button
                            className="btn btn-danger"
                            onClick={executeStop}
                            style={{ flex: 1, height: '48px', gap: '10px', background: '#ef4444', color: 'white', border: 'none' }}
                        >
                            <Square size={18} /> Stop & Save
                        </button>
                    )}
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                        disabled={isScanning}
                        style={{ padding: '0 25px' }}
                    >
                        Cancel
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes scanLine {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
            `}</style>
        </Modal>
    );
};

export default FaceScannerModal;
