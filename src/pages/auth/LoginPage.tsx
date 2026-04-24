import React, { useState, useRef } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { authService } from '@/services/authService';
import { AlertTriangle, ArrowLeft, CalendarClock, ShieldCheck, Sparkles, Users2, UserCheck } from 'lucide-react';
import { SystemRoleEnum } from '@/types/enums';
import logo from '@/assets/aita.png';
import './LoginPage.css';
import VisitorRegistrationModal from '@/components/schedule/VisitorRegistrationModal';

const loginHighlights = [
    {
        icon: <CalendarClock size={18} />,
        title: 'One timeline for meetings and milestones',
        desc: 'Track every seminar, booking, and project checkpoint from one place.',
    },
    {
        icon: <Users2 size={18} />,
        title: 'Built for collaborative research groups',
        desc: 'Coordinate supervisors, lab managers, and members with real-time updates.',
    },
    {
        icon: <ShieldCheck size={18} />,
        title: 'Institution account protected access',
        desc: 'Sign in safely with Google Workspace and continue in your lab context.',
    },
];

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const handlingRef = useRef(false);

    const getPostLoginPath = (role: string | number | undefined) => {
        const roleNumber = Number(role);
        const roleString = String(role ?? '');
        if (roleNumber === SystemRoleEnum.Admin || roleString === 'Admin') return '/user-management';
        return '/dashboard';
    };

    if (authService.isAuthenticated()) {
        const stored = authService.getAuthUser();
        return <Navigate to={getPostLoginPath(stored?.role)} replace />;
    }

    // Combined Login & Calendar consent flow
    const loginWithGoogle = useGoogleLogin({
        flow: 'auth-code',
        scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
        onSuccess: async (response) => {
            if (handlingRef.current) return;
            handlingRef.current = true;
            setLoading(true);
            setError(null);
            try {
                // Call the new unified endpoint: /api/auth/google-code
                const authData = await authService.loginWithCode(
                    response.code,
                    "postmessage"
                );
                
                // If the user context requires it, set the calendar authorized flag
                localStorage.setItem('calendar_authorized', 'true');
                navigate(getPostLoginPath(authData?.role), { replace: true });
            } catch (err: any) {
                console.error('Login error:', err);
                const serverMessage = err?.response?.data?.message || err?.message || 'Login failed. Please try again.';
                setError(serverMessage);
                setLoading(false);
                handlingRef.current = false;
            }
        },
        onError: () => {
            setError('Google sign-in failed. Please try again.');
            setLoading(false);
            handlingRef.current = false;
        },
    });

    return (
        <div className="signin-page">
            <div className="signin-glow signin-glow-top" />
            <div className="signin-glow signin-glow-bottom" />

            <div className="signin-shell">
                <section className="signin-intro signin-enter" style={{ animationDelay: '80ms' }}>
                    <Link to="/" className="signin-home-link">
                        <ArrowLeft size={15} />
                        Back to Homepage
                    </Link>

                    <div className="signin-pill">
                        <Sparkles size={14} />
                        Welcome to LabSync
                    </div>

                    <h1>Run your lab in a brighter flow.</h1>
                    <p>
                        Sign in to continue managing seminars, project milestones, and resource bookings in your
                        institutional workspace.
                    </p>

                    <div className="signin-benefits">
                        {loginHighlights.map((item, index) => (
                            <article
                                key={item.title}
                                className="signin-benefit-card signin-enter"
                                style={{ animationDelay: `${180 + index * 80}ms` }}
                            >
                                <span className="signin-benefit-icon">{item.icon}</span>
                                <div>
                                    <h3>{item.title}</h3>
                                    <p>{item.desc}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="signin-card signin-enter" style={{ animationDelay: '220ms' }}>
                    <div className="signin-logo-wrap" aria-hidden="true">
                        <img src={logo} alt="AiTaLab" className="signin-logo" />
                    </div>

                    <h2>Sign in to LabSync</h2>
                    <p className="signin-card-sub">Use your institutional Google account to enter the platform.</p>

                    <button
                        type="button"
                        onClick={() => loginWithGoogle()}
                        className="signin-google-btn"
                        disabled={loading}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>

                    {loading && (
                        <p className="signin-loading">
                            <span className="signin-loading-dot" aria-hidden="true" />
                            Authenticating your workspace access...
                        </p>
                    )}

                    {error && (
                        <div className="signin-error" role="alert">
                            <AlertTriangle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '1rem 0', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Not a lab member?</p>
                        <button
                            type="button"
                            onClick={() => setShowRegister(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: '0.3rem 0.5rem', fontSize: '0.85rem', color: 'var(--accent-color)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                        >
                            <UserCheck size={15} />
                            Book a Meeting
                        </button>
                    </div>

                    <p className="signin-disclaimer">
                        Internal access only. Unauthorized attempts are logged and reviewed.
                    </p>

                    <div className="signin-legal">
                        <Link to="/privacy">Privacy Policy</Link>
                        <span className="signin-legal-dot">•</span>
                        <Link to="/terms">Terms of Service</Link>
                    </div>
                </section>
            </div>
            <VisitorRegistrationModal isOpen={showRegister} onClose={() => setShowRegister(false)} />
        </div>
    );
};

export default LoginPage;
