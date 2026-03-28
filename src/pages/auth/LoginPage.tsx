import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { authService } from '@/services/authService';
import { FlaskConical, AlertTriangle } from 'lucide-react';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    if (authService.isAuthenticated()) {
        return <Navigate to="/dashboard" replace />;
    }

    // Combined Login & Calendar consent flow
    const loginWithGoogle = useGoogleLogin({
        flow: 'auth-code',
        scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
        onSuccess: async (response) => {
            setLoading(true);
            setError(null);
            try {
                // Call the new unified endpoint: /api/auth/google-code
                await authService.loginWithCode(
                    response.code,
                    "postmessage"
                );
                
                // If the user context requires it, set the calendar authorized flag
                localStorage.setItem('calendar_authorized', 'true');
                navigate('/dashboard', { replace: true });
            } catch (err: any) {
                console.error('Lỗi đăng nhập:', err);
                const serverMessage = err?.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
                setError(serverMessage);
                setLoading(false);
            }
        },
        onError: () => {
            setError('Đăng nhập Google thất bại. Vui lòng thử lại.');
            setLoading(false);
        },
    });

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
                    color: '#f1f5f9', fontSize: '2.25rem', fontWeight: 800,
                    marginBottom: '0.25rem', letterSpacing: '-0.025em',
                }}>
                    LabSync
                </h1>
                <p style={{
                    color: '#94a3b8', fontSize: '0.95rem',
                    marginBottom: '2rem', lineHeight: 1.6,
                }}>
                    Advanced Laboratory Management System
                </p>

                {/* Divider */}
                <div style={{
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.3), transparent)',
                    marginBottom: '2rem',
                }} />

                <p style={{
                    color: '#cbd5e1', fontSize: '0.9rem',
                    marginBottom: '1.5rem',
                    fontWeight: 500,
                }}>
                    Sign in with your institutional account
                </p>

                {/* Google Login Button */}
                <div style={{
                    display: 'flex', justifyContent: 'center',
                    marginBottom: '1.5rem',
                    opacity: loading ? 0.5 : 1,
                    pointerEvents: loading ? 'none' : 'auto',
                    transition: 'all 0.2s ease',
                }}>
                    <button
                        onClick={() => loginWithGoogle()}
                        style={{
                            width: '100%',
                            height: '52px',
                            background: '#ffffff',
                            color: '#0f172a',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.2)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>
                </div>

                {loading && (
                    <p style={{
                        color: '#818cf8', fontSize: '0.85rem',
                        marginBottom: '1rem',
                        fontWeight: 600,
                        animation: 'pulse 1.5s infinite',
                    }}>
                        Authenticating...
                    </p>
                )}

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        color: '#fca5a5',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        justifyContent: 'center'
                    }}>
                        <AlertTriangle size={16} />
                        {error}
                    </div>
                )}

                {/* Footer */}
                <div style={{
                    marginTop: '2rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid rgba(148,163,184,0.1)',
                }}>
                    <p style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, margin: 0 }}>
                        Internal access only. Unauthorized attempts will be logged and reported.
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
