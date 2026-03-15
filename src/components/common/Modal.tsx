import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    variant?: 'danger' | 'info' | 'success';
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, variant = 'info', maxWidth = '480px' }) => {
    if (!isOpen) return null;

    const getHeaderColor = () => {
        const BRAND_ORANGE = '#ea580c';
        const BRAND_SLATE = '#475569';
        switch (variant) {
            case 'danger': 
            case 'success': return BRAND_ORANGE;
            default: return BRAND_SLATE;
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
        }} onClick={onClose}>
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: maxWidth,
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: `${getHeaderColor()}08`
                }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: getHeaderColor(), fontWeight: 700 }}>{title}</h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '1.5rem', fontSize: '0.95rem', color: '#475569', lineHeight: 1.6 }}>
                    {children}
                </div>

                {footer && (
                    <div style={{
                        padding: '1rem 1.5rem',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        background: '#f8fafc'
                    }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
