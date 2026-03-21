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

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for fade out animation
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

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
        <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 24px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            border: '1.5px solid rgba(255, 255, 255, 0.8)',
            borderLeft: `6px solid ${getBorderColor()}`,
            transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(100px) scale(0.9)',
            opacity: isVisible ? 1 : 0,
            transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            minWidth: '350px',
            maxWidth: '500px'
        }}>
            <div style={{ flexShrink: 0 }}>
                {getIcon()}
            </div>
            <div style={{ flex: 1, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', letterSpacing: '-0.01em' }}>
                {message}
            </div>
            <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(onClose, 300);
                }}
                style={{
                    background: 'rgba(0,0,0,0.04)',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)')}
            >
                <X size={16} />
            </button>

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
