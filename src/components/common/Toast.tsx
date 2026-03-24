import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', duration = 3000, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (!isPaused) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onClose, 300); // Wait for fade out animation
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose, isPaused]);

    const getIcon = () => {
        switch (type) {
            case 'success': return <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '10px' }}><CheckCircle size={20} color="#10b981" /></div>;
            case 'error': return <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '10px' }}><AlertCircle size={20} color="#ef4444" /></div>;
            case 'warning': return <div style={{ background: '#fff7ed', padding: '8px', borderRadius: '10px' }}><AlertCircle size={20} color="#f59e0b" /></div>;
            default: return <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '10px' }}><Info size={20} color="#3b82f6" /></div>;
        }
    };

    const getBorderColor = () => {
        switch (type) {
            case 'success': return '#10b981';
            case 'error': return '#ef4444';
            case 'warning': return '#f59e0b';
            default: return '#3b82f6';
        }
    };

    return (
        <div 
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            style={{
                position: 'fixed',
                top: '24px',
                right: '24px',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center', // Aligned icon and text
                gap: '16px',
                padding: '14px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(25px) saturate(200%)',
                borderRadius: '16px',
                boxShadow: '0 12px 32px -8px rgba(0, 0, 0, 0.12), 0 4px 12px -4px rgba(0, 0, 0, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.7)',
                borderLeft: `5px solid ${getBorderColor()}`,
                transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(50px) scale(0.95)',
                opacity: isVisible ? 1 : 0,
                transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
                minWidth: '320px',
                maxWidth: '480px',
                marginBottom: '4px' // Spacing between stacked items
            }}
        >
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {getIcon()}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.01em', lineHeight: 1.4 }}>
                    {message.split('.').length > 1 ? (
                        <>
                            <div style={{ marginBottom: '4px' }}>{message.split('.')[0]}.</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', whiteSpace: 'pre-line' }}>
                                {message.split('.').slice(1).join('.').trim()}
                            </div>
                        </>
                    ) : (
                        message
                    )}
                </div>
            </div>
            <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(onClose, 300);
                }}
                style={{
                    background: 'rgba(0,0,0,0.03)',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)')}
            >
                <X size={14} />
            </button>

            {/* Premium Progress Bar */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '3px',
                backgroundColor: getBorderColor(),
                width: isVisible && !isPaused ? '0%' : '100%',
                transition: isVisible && !isPaused ? `width ${duration}ms linear` : 'none',
                opacity: 0.6,
                borderBottomLeftRadius: '16px'
            }} />

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Toast;
