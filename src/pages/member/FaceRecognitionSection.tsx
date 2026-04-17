import React, { useState } from 'react';
import { Camera, ShieldCheck, Trash2, Ban, RotateCcw } from 'lucide-react';
import { faceService } from '@/services/faceService';
import { useToastStore } from '@/store/slices/toastSlice';
import ConfirmModal from '@/components/common/ConfirmModal';

interface FaceRecognitionSectionProps {
    studentId: string;
    userName: string;
    onScanFace: (studentId: string, userName: string) => void;
}

const FaceRecognitionSection: React.FC<FaceRecognitionSectionProps> = ({ studentId, userName, onScanFace }) => {
    const { addToast } = useToastStore();
    const [confirmRemove, setConfirmRemove] = useState(false);

    const handleAction = async (action: string) => {
        if (!studentId) {
            addToast('Student ID is missing.', 'error');
            return;
        }
        if (action === 'Remove') {
            setConfirmRemove(true);
            return;
        }
        try {
            let response;
            switch (action) {
                case 'Ban':
                    response = await faceService.banUser(studentId);
                    break;
                case 'Unban':
                    response = await faceService.unbanUser(studentId);
                    break;
                default:
                    return;
            }
            addToast(response?.message || `${action} successful.`, 'success');
        } catch (err) {
            console.error(`${action} failed:`, err);
            addToast(`Failed to perform ${action}. Please check if the Biometric server is running.`, 'error');
        }
    };

    const handleConfirmRemove = async () => {
        setConfirmRemove(false);
        try {
            const response = await faceService.removeUser(studentId);
            addToast(response?.message || 'Biometrics removed successfully.', 'success');
        } catch (err) {
            console.error('Remove failed:', err);
            addToast('Failed to remove biometrics. Please check if the Biometric server is running.', 'error');
        }
    };

    return (
        <>
        <div style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem'
        }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: 'var(--primary-color)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        <ShieldCheck size={15} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>Biometric Security</h4>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={() => onScanFace(studentId, userName)}
                    style={{ gap: '5px', padding: '5px 10px', background: '#10b981', fontSize: '0.72rem', flexShrink: 0 }}
                >
                    <Camera size={13} /> Scan Face
                </button>
            </div>

            {/* Quick Actions Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.4rem',
                paddingTop: '0.4rem',
                borderTop: '1px solid var(--border-color)'
            }}>
                <button className="btn btn-secondary" onClick={() => handleAction('Remove')} style={{ gap: '4px', fontSize: '0.68rem', padding: '4px 6px', color: '#ef4444' }}>
                    <Trash2 size={12} /> Remove
                </button>
                <button className="btn btn-secondary" onClick={() => handleAction('Ban')} style={{ gap: '4px', fontSize: '0.68rem', padding: '4px 6px', color: '#f59e0b' }}>
                    <Ban size={12} /> Suspend
                </button>
                <button className="btn btn-secondary" onClick={() => handleAction('Unban')} style={{ gap: '4px', fontSize: '0.68rem', padding: '4px 6px', color: '#3b82f6' }}>
                    <RotateCcw size={12} /> Restore
                </button>
            </div>
        </div>

        <ConfirmModal
            isOpen={confirmRemove}
            onClose={() => setConfirmRemove(false)}
            onConfirm={handleConfirmRemove}
            title="Remove Biometrics"
            message={<>Are you sure you want to remove biometrics for <strong>{userName}</strong>? This action cannot be undone.</>}
            confirmText="Remove"
            variant="danger"
        />
        </>
    );
};

export default FaceRecognitionSection;
