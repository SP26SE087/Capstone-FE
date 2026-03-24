import React, { useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { GoogleLogin, CredentialResponse, useGoogleLogin } from '@react-oauth/google';
import { authService } from '@/services/authService';
import { FlaskConical } from 'lucide-react';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    if (authService.isAuthenticated()) {
        return <Navigate to="/home" replace />;
    }

    // Google Calendar consent — opens Google's native consent popup
    const requestCalendarConsent = useGoogleLogin({
        flow: 'auth-code',
        scope: 'https://www.googleapis.com/auth/calendar.events',
        onSuccess: () => {
            localStorage.setItem('calendar_authorized', 'true');
            navigate('/home', { replace: true });
        },
        onError: () => {
            // User denied or error — still go to home, just without calendar
            navigate('/home', { replace: true });
        },
    });

    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        if (!credentialResponse.credential) {
            setError('Không nhận được thông tin từ Google. Vui lòng thử lại.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await authService.loginWithGoogle(credentialResponse.credential);
            // After login, open Google's Calendar consent popup
            requestCalendarConsent();
        } catch (err: any) {
            const status = err?.response?.status;
            const serverMessage = typeof err?.response?.data === 'string'
                ? err.response.data
                : err?.response?.data?.message;

            if (status === 401) {
                setError('Tài khoản chưa được cấp quyền trong hệ thống. Liên hệ Admin để được thêm.');
            } else if (status === 400) {
                setError(serverMessage || 'Token Google không hợp lệ. Vui lòng thử lại.');
            } else if (status && serverMessage) {
                setError(serverMessage);
            } else {
                setError('Không thể kết nối đến server. Vui lòng kiểm tra backend đang chạy.');
            }
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Đăng nhập Google thất bại. Vui lòng thử lại.');
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Decorative background orbs */}
            <div style={{
                position: 'absolute', width: '500px', height: '500px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
                top: '-150px', right: '-100px', borderRadius: '50%',
            }} />
            <div style={{
                position: 'absolute', width: '400px', height: '400px',
                background: 'radial-gradient(circle, rgba(232,114,12,0.12) 0%, transparent 70%)',
                bottom: '-100px', left: '-80px', borderRadius: '50%',
            }} />

            {/* Login Card */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.7)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                borderRadius: '20px',
                padding: '3rem 2.5rem',
                width: '100%',
                maxWidth: '420px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
                position: 'relative',
                zIndex: 2,
                textAlign: 'center',
            }}>
                {/* Logo */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '12px', marginBottom: '0.75rem',
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        padding: '12px', borderRadius: '14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FlaskConical size={28} color="white" />
                    </div>
                </div>

                <h1 style={{
                    color: '#f1f5f9', fontSize: '1.75rem', fontWeight: 700,
                    marginBottom: '0.25rem', letterSpacing: '-0.025em',
                }}>
                    AiTA Lab
                </h1>
                <p style={{
                    color: '#94a3b8', fontSize: '0.9rem',
                    marginBottom: '2rem', lineHeight: 1.6,
                }}>
                    Lab Management System
                </p>

                {/* Divider */}
                <div style={{
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.3), transparent)',
                    marginBottom: '2rem',
                }} />

                <p style={{
                    color: '#cbd5e1', fontSize: '0.85rem',
                    marginBottom: '1.5rem',
                }}>
                    Đăng nhập bằng tài khoản Google của bạn
                </p>

                {/* Google Login Button */}
                <div style={{
                    display: 'flex', justifyContent: 'center',
                    marginBottom: '1.5rem',
                    opacity: loading ? 0.5 : 1,
                    pointerEvents: loading ? 'none' : 'auto',
                    transition: 'opacity 0.2s ease',
                }}>
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        theme="filled_black"
                        size="large"
                        shape="pill"
                        text="signin_with"
                        width="320"
                    />
                </div>

                {loading && (
                    <p style={{
                        color: '#818cf8', fontSize: '0.8rem',
                        marginBottom: '1rem',
                        animation: 'pulse 1.5s infinite',
                    }}>
                        Đang xác thực...
                    </p>
                )}

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '10px',
                        color: '#fca5a5',
                        fontSize: '0.82rem',
                        lineHeight: 1.5,
                        marginBottom: '1rem',
                    }}>
                        {error}
                    </div>
                )}

                {/* Footer */}
                <div style={{
                    marginTop: '1.5rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid rgba(148,163,184,0.1)',
                }}>
                    <p style={{ color: '#64748b', fontSize: '0.72rem', margin: 0 }}>
                        Chỉ tài khoản đã được Admin cấp quyền mới đăng nhập được.
                    </p>
                </div>
            </div>

            {/* Pulse animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
};

export default LoginPage;
