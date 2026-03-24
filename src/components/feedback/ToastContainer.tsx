import React from 'react';
import { useToastStore } from '@/store/slices/toastSlice';
import Toast from '@/components/common/Toast';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10001, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
