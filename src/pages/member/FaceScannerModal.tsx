import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import { Camera, User as UserIcon, ShieldCheck, Play, Square } from 'lucide-react';
import { faceService } from '@/services/faceService';

interface FaceScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialUserId: string;
    userName: string;
}

const FaceScannerModal: React.FC<FaceScannerModalProps> = ({ isOpen, onClose, initialUserId, userName }) => {
    const [userId, setUserId] = useState(initialUserId);
    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setUserId(initialUserId);
            setIsScanning(false);
            setStatus(null);
        }
    }, [isOpen, initialUserId]);

    const handleStart = async () => {
        if (!userId) {
            alert('Please enter a User ID');
            return;
        }
        setIsScanning(true);
        setStatus('Connecting to Biometric Engine...');
        
        try {
            const data = await faceService.startAddUser(userId);
            setStatus(data.message || 'System Active. Scanning face...');
        } catch (err) {
            console.error('Start scan failed:', err);
            setStatus('Connection failed. Is the Biometric BE running?');
            setIsScanning(false);
            alert('Failed to start biometric registration.');
        }
    };

    const handleStop = async () => {
        setStatus('Saving data...');
        try {
            await faceService.stopAddUser();
            setIsScanning(false);
            setStatus(null);
            alert('Biometric registration process stopped.');
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
                    </p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Confirm User ID</label>
                    <div style={{ position: 'relative' }}>
                        <UserIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input 
                            type="text" 
                            className="form-input" 
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            style={{ paddingLeft: '40px' }}
                            placeholder="Enter unique ID..."
                            disabled={isScanning}
                        />
                    </div>
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
                    {isScanning ? (
                        <>
                            <div className="animate-spin" style={{ 
                                width: '100px', height: '100px', borderRadius: '50%',
                                border: '3px solid rgba(255, 255, 255, 0.1)',
                                borderTopColor: 'var(--accent-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Camera size={40} className="animate-pulse" style={{ color: 'white' }} />
                            </div>
                            <div style={{ textAlign: 'center', color: 'white', zIndex: 1 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>SCANNING...</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{status}</div>
                            </div>
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                background: 'rgba(232, 114, 12, 0.5)',
                                animation: 'scanLine 2s infinite linear',
                                boxShadow: '0 0 15px var(--accent-color)'
                            }} />
                        </>
                    ) : (
                        <>
                            <Camera size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Camera system ready</p>
                        </>
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
