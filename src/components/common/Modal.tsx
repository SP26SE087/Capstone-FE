import React from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    variant?: 'danger' | 'info' | 'success';
    maxWidth?: string;
    disableBackdropClose?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, variant = 'info', maxWidth = '680px', disableBackdropClose = false }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 15000,
            padding: '1.5rem',
            animation: 'fadeIn 0.3s ease-out'
        }} onClick={disableBackdropClose ? undefined : onClose}>
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: 'var(--radius-lg)',
                    width: '100%',
                    maxWidth: maxWidth,
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    border: '1px solid var(--border-color)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{
                    padding: '1.5rem 1.75rem',
                    background: variant === 'danger' ? '#fff1f2' : (variant === 'success' ? '#f0fdf4' : '#f8fafc'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <h3 style={{ 
                        margin: 0, 
                        fontSize: '1.25rem', 
                        color: variant === 'danger' ? '#e11d48' : (variant === 'success' ? '#16a34a' : '#0f172a'), 
                        fontWeight: 800,
                        letterSpacing: '-0.02em'
                    }}>
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        style={{ 
                            background: 'rgba(0,0,0,0.05)', 
                            border: 'none', 
                            color: '#64748b', 
                            cursor: 'pointer', 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)')}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)')}
                    >
                        <X size={18} />
                    </button>
                </div>
 
                <div style={{ padding: '2rem 1.75rem', fontSize: '1rem', color: '#334155', lineHeight: 1.6 }}>
                    {children}
                </div>
 
                {footer && (
                    <div style={{
                        padding: '1.25rem 1.75rem',
                        background: '#f8fafc',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        borderTop: '1px solid #f1f5f9'
                    }}>
                        {footer}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px) scale(0.98); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default Modal;
