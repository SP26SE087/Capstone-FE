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
            case 'success': return <CheckCircle size={20} color="#10b981" />;
            case 'error': return <AlertCircle size={20} color="#ef4444" />;
            case 'warning': return <AlertCircle size={20} color="#f59e0b" />;
            default: return <Info size={20} color="#3b82f6" />;
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
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            borderLeft: `4px solid ${getBorderColor()}`,
            transform: isVisible ? 'translateX(0)' : 'translateX(120%)',
            opacity: isVisible ? 1 : 0,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minWidth: '320px',
            maxWidth: '450px'
        }}>
            <div style={{ flexShrink: 0 }}>
                {getIcon()}
            </div>
            <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500, color: '#1f2937' }}>
                {message}
            </div>
            <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(onClose, 300);
                }}
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
