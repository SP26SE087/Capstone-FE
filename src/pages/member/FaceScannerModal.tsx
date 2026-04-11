import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import { Camera, ShieldCheck, Play, Square } from 'lucide-react';
import { faceService } from '@/services/faceService';
import { useToastStore } from '@/store/slices/toastSlice';

interface FaceScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialStudentId: string;
    userName: string;
}

const FACE_SERVER_URL = (import.meta.env.VITE_FACE_SERVER_URL as string || 'http://localhost:5000').replace(/\/$/, '');
const FACE_VIDEO_FEED = `${FACE_SERVER_URL}/video_feed`;

const FaceScannerModal: React.FC<FaceScannerModalProps> = ({ isOpen, onClose, initialStudentId, userName }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [videoSrc, setVideoSrc] = useState(FACE_VIDEO_FEED);
    const { addToast } = useToastStore();

    useEffect(() => {
        if (isOpen) {
            setIsScanning(false);
            setStatus(null);
            setVideoSrc(`${FACE_VIDEO_FEED}?t=${Date.now()}`);
        }
    }, [isOpen, initialStudentId]);

    // Refresh MJPEG stream every 5 seconds (same as ui.html)
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setVideoSrc(`${FACE_VIDEO_FEED}?t=${Date.now()}`);
        }, 5000);
        return () => clearInterval(interval);
    }, [isOpen]);

    const handleStart = async () => {
        const studentId = String(initialStudentId || '').trim();
        if (!studentId) {
            alert('Student ID is missing.');
            return;
        }
        setIsScanning(true);
        setStatus('Connecting to Biometric Engine...');
        
        try {
            const data = await faceService.startAddUser(studentId);
            setStatus(data.message || 'System Active. Scanning face...');
        } catch (err) {
            console.error('Start scan failed:', err);
            setStatus('Connection failed. Is the Biometric BE running?');
            setIsScanning(false);
            addToast((err as any).message || 'Failed to start biometric registration.', 'error');
        }
    };

    const handleStop = async () => {
        setStatus('Saving data...');
        try {
            await faceService.stopAddUser();
            setIsScanning(false);
            setStatus(null);
            addToast('Biometric registration process stopped.', 'success');
        } catch (err) {
            console.error('Stop scan failed:', err);
            setIsScanning(false);
            setStatus(null);
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
                            background: 'rgba(0,0,0,0.1)',
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <Camera size={24} style={{ color: 'white', opacity: 0.6, marginBottom: '0.5rem' }} />
                            <p style={{ color: 'white', fontSize: '0.75rem', margin: 0, fontWeight: 500 }}>Camera active. Ready to register.</p>
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
                            onClick={handleStop}
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
