import React, { useState } from 'react';
import { Camera, ShieldCheck, Trash2, Ban, RotateCcw } from 'lucide-react';
import FaceScannerModal from './FaceScannerModal';
import { faceService } from '@/services/faceService';

interface FaceRecognitionSectionProps {
    userId: string;
    userName: string;
}

const FaceRecognitionSection: React.FC<FaceRecognitionSectionProps> = ({ userId, userName }) => {
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const handleAction = async (action: string) => {
        if (!userId) {
            alert('User ID is missing.');
            return;
        }

        try {
            let response;
            switch (action) {
                case 'Remove':
                    if (!window.confirm(`Are you sure you want to remove biometrics for ${userName}?`)) return;
                    response = await faceService.removeUser(userId);
                    break;
                case 'Ban':
                    response = await faceService.banUser(userId);
                    break;
                case 'Unban':
                    response = await faceService.unbanUser(userId);
                    break;
                default:
                    return;
            }
            alert(response?.message || `${action} successful.`);
        } catch (err) {
            console.error(`${action} failed:`, err);
            alert(`Failed to perform ${action}. Please check if the Biometric server is running.`);
        }
    };

    return (
        <div style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
        }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'var(--primary-color)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Biometric Security</h4>
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={() => setIsScannerOpen(true)}
                    style={{ gap: '8px', padding: '8px 16px', background: '#10b981', fontSize: '0.8rem' }}
                >
                    <Camera size={16} /> Scan Face
                </button>
            </div>

            {/* Quick Actions Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border-color)'
            }}>
                <button className="btn btn-secondary" onClick={() => handleAction('Remove')} style={{ gap: '6px', fontSize: '0.75rem', color: '#ef4444' }}>
                    <Trash2 size={14} /> Remove
                </button>
                <button className="btn btn-secondary" onClick={() => handleAction('Ban')} style={{ gap: '6px', fontSize: '0.75rem', color: '#f59e0b' }}>
                    <Ban size={14} /> Suspend
                </button>
                <button className="btn btn-secondary" onClick={() => handleAction('Unban')} style={{ gap: '6px', fontSize: '0.75rem', color: '#3b82f6' }}>
                    <RotateCcw size={14} /> Restore
                </button>
            </div>

            <FaceScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                initialUserId={userId}
                userName={userName}
            />
        </div>
    );
};

export default FaceRecognitionSection;
