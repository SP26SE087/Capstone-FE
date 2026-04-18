import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, FileText, Calendar, Box, Users, BarChart2 } from 'lucide-react';
import logo from '@/assets/aita.png';
import { authService } from '@/services/authService';
import { SystemRoleEnum } from '@/types/enums';

const features = [
    { icon: <Briefcase size={22} />, title: 'Project Management', desc: 'Organize and track research projects with milestones, tasks, and timelines.' },
    { icon: <FileText size={22} />, title: 'Paper Submissions', desc: 'Submit and review academic papers within your research group.' },
    { icon: <Calendar size={22} />, title: 'Schedule & Seminars', desc: 'Manage lab schedules, seminars, and meeting sessions effortlessly.' },
    { icon: <Box size={22} />, title: 'Resource Booking', desc: 'Book lab equipment and resources with a real-time availability system.' },
    { icon: <Users size={22} />, title: 'Team Collaboration', desc: 'Invite members, assign roles, and collaborate across research teams.' },
    { icon: <BarChart2 size={22} />, title: 'Reports & Feedback', desc: 'Generate progress reports and collect feedback from supervisors.' },
];

const LandingPage: React.FC = () => {
    const isLoggedIn = authService.isAuthenticated();
    const stored = authService.getAuthUser();
    const appPath = Number(stored?.role) === SystemRoleEnum.Admin ? '/user-management' : '/dashboard';

    return (
        <div style={{ minHeight: 'calc(100vh / 0.9)', fontFamily: 'Be Vietnam Pro, sans-serif', background: '#f8fafc', color: '#1e293b' }}>
            {/* Nav */}
            <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 2rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={logo} alt="AiTaLab" style={{ height: 36, width: 36, objectFit: 'contain' }} />
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                        AiTaLab <span style={{ color: '#e8720c' }}>LabSync</span>
                    </span>
                </div>
                <Link to={isLoggedIn ? appPath : '/login'} style={{ background: '#e8720c', color: '#fff', padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>
                    {isLoggedIn ? 'Go to App' : 'Sign In'}
                </Link>
            </nav>

            {/* Hero */}
            <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: '#fff', padding: '80px 2rem', textAlign: 'center' }}>
                <div style={{ maxWidth: 720, margin: '0 auto' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(232,114,12,0.15)', border: '1px solid rgba(232,114,12,0.4)', borderRadius: 9999, padding: '4px 14px', marginBottom: 24, fontSize: '0.85rem', color: '#ff9643' }}>
                        Research Lab Management Platform
                    </div>
                    <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, margin: '0 0 20px', lineHeight: 1.2 }}>
                        Streamline Your <span style={{ color: '#e8720c' }}>Lab Research</span> Workflow
                    </h1>
                    <p style={{ fontSize: '1.1rem', color: '#94a3b8', margin: '0 0 36px', lineHeight: 1.7 }}>
                        LabSync is an all-in-one platform for academic research labs — manage projects, schedule resources, collaborate with your team, and track progress from one place.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link to={isLoggedIn ? appPath : '/login'} style={{ background: '#e8720c', color: '#fff', padding: '12px 28px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '1rem' }}>
                            {isLoggedIn ? 'Go to App →' : 'Get Started →'}
                        </Link>
                        <a href="#features" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '12px 28px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '1rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                            Learn More
                        </a>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" style={{ padding: '80px 2rem' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <h2 style={{ textAlign: 'center', fontSize: '1.75rem', fontWeight: 800, marginBottom: 8 }}>Everything your lab needs</h2>
                    <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 48 }}>Designed for researchers, lab managers, and academic teams.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                        {features.map((f) => (
                            <div key={f.title} style={{ background: '#fff', borderRadius: 12, padding: '24px', border: '1px solid #e2e8f0' }}>
                                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(232,114,12,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e8720c', marginBottom: 14 }}>{f.icon}</div>
                                <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>{f.title}</h3>
                                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{ background: '#1e293b', color: '#fff', padding: '60px 2rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 12 }}>Ready to get started?</h2>
                <p style={{ color: '#94a3b8', marginBottom: 28 }}>Sign in with your institutional account to access LabSync.</p>
                <Link to={isLoggedIn ? appPath : '/login'} style={{ background: '#e8720c', color: '#fff', padding: '12px 32px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '1rem' }}>
                    {isLoggedIn ? 'Go to App' : 'Sign In Now'}
                </Link>
            </section>

            {/* Footer */}
            <footer style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '24px 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>© {new Date().getFullYear()} AiTaLab. All rights reserved.</span>
                <div style={{ display: 'flex', gap: 20 }}>
                    <Link to="/privacy" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none' }}>Privacy Policy</Link>
                    <Link to="/terms" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none' }}>Terms of Service</Link>
                    <a href="mailto:contact@aitalab.edu.vn" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none' }}>Contact</a>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
