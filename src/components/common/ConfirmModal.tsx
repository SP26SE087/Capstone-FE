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
    const getIcon = () => {
        switch (variant) {
            case 'danger': return <AlertTriangle size={32} color="#e11d48" />;
            case 'success': return <CheckCircle2 size={32} color="#16a34a" />;
            default: return <HelpCircle size={32} color="#3b82f6" />;
        }
    };

    const getColors = () => {
        switch (variant) {
            case 'danger': return { primary: '#e11d48', bg: '#fff1f2' };
            case 'success': return { primary: '#16a34a', bg: '#f0fdf4' };
            default: return { primary: '#3b82f6', bg: '#eff6ff' };
        }
    };

    const colors = getColors();

    const footer = (
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button 
                onClick={onClose} 
                className="btn btn-secondary" 
                style={{ 
                    flex: 1,
                    padding: '0.75rem 1.5rem', 
                    borderRadius: '12px',
                    fontWeight: 600,
                    border: '1px solid #e2e8f0'
                }}
            >
                {cancelText}
            </button>
            <button 
                onClick={() => {
                    onConfirm();
                }} 
                style={{ 
                    flex: 1,
                    padding: '0.75rem 1.5rem', 
                    borderRadius: '12px', 
                    border: 'none', 
                    background: colors.primary, 
                    color: 'white', 
                    fontWeight: 700, 
                    cursor: 'pointer',
                    boxShadow: `0 10px 15px -3px ${colors.primary}40`,
                    transition: 'all 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
                {confirmText}
            </button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} variant={variant} footer={footer} maxWidth="440px">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem' }}>
                <div style={{ 
                    padding: '20px', 
                    borderRadius: '24px', 
                    background: colors.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {getIcon()}
                </div>
                <div>
                    <p style={{ margin: 0, fontSize: '1.05rem', color: '#334155', lineHeight: 1.6, fontWeight: 500 }}>
                        {message}
                    </p>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmModal;
