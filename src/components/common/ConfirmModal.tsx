import React from 'react';
import Modal from './Modal';
import { AlertTriangle, HelpCircle, CheckCircle2 } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'info' | 'success';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'info'
}) => {
    // Brand colors: Cam (Orange) and Xanh Xám (Slate/Blue-Gray)
    const BRAND_ORANGE = '#ea580c';
    const BRAND_SLATE = '#475569';

    const getIcon = () => {
        switch (variant) {
            case 'danger': return <AlertTriangle size={32} color={BRAND_ORANGE} />;
            case 'success': return <CheckCircle2 size={32} color={BRAND_ORANGE} />;
            default: return <HelpCircle size={32} color={BRAND_SLATE} />;
        }
    };

    const getPrimaryColor = () => {
        // Use Orange for all primary/confirm actions to keep it simple
        return BRAND_ORANGE;
    };

    const footer = (
        <>
            <button 
                onClick={onClose} 
                className="btn btn-secondary" 
                style={{ 
                    padding: '0.6rem 1.5rem', 
                    borderRadius: '10px',
                    color: BRAND_SLATE,
                    fontWeight: 600
                }}
            >
                {cancelText}
            </button>
            <button 
                onClick={() => {
                    onConfirm();
                    onClose();
                }} 
                style={{ 
                    padding: '0.6rem 2rem', 
                    borderRadius: '10px', 
                    border: 'none', 
                    background: getPrimaryColor(), 
                    color: 'white', 
                    fontWeight: 700, 
                    cursor: 'pointer',
                    boxShadow: `0 4px 6px -1px ${getPrimaryColor()}33`
                }}
            >
                {confirmText}
            </button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} variant={variant} footer={footer}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                <div style={{ 
                    flexShrink: 0, 
                    padding: '12px', 
                    borderRadius: '12px', 
                    background: variant === 'info' ? `${BRAND_SLATE}10` : `${BRAND_ORANGE}10` 
                }}>
                    {getIcon()}
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: BRAND_SLATE, lineHeight: 1.6, fontWeight: 500 }}>
                        {message}
                    </p>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmModal;
