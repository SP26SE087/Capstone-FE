import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart2, Box, Briefcase, Calendar, FileText, Sparkles, Users } from 'lucide-react';
import logo from '@/assets/aita.png';
import { authService } from '@/services/authService';
import { SystemRoleEnum } from '@/types/enums';
import './LandingPage.css';

const features = [
    { icon: <Briefcase size={22} />, title: 'Project Management', desc: 'Organize and track research projects with milestones, tasks, and timelines.' },
    { icon: <FileText size={22} />, title: 'Paper Submissions', desc: 'Submit and review academic papers within your research group.' },
    { icon: <Calendar size={22} />, title: 'Schedule & Seminars', desc: 'Manage lab schedules, seminars, and meeting sessions effortlessly.' },
    { icon: <Box size={22} />, title: 'Resource Booking', desc: 'Book lab equipment and resources with a real-time availability system.' },
    { icon: <Users size={22} />, title: 'Team Collaboration', desc: 'Invite members, assign roles, and collaborate across research teams.' },
    { icon: <BarChart2 size={22} />, title: 'Reports & Feedback', desc: 'Generate progress reports and collect feedback from supervisors.' },
];

const highlights = [
    { value: '40+', label: 'Active research teams' },
    { value: '1 dashboard', label: 'For schedules, papers, and resources' },
    { value: 'Real-time', label: 'Updates for collaborators' },
];

const LandingPage: React.FC = () => {
    const isLoggedIn = authService.isAuthenticated();
    const stored = authService.getAuthUser();
    const appPath = Number(stored?.role) === SystemRoleEnum.Admin ? '/user-management' : '/dashboard';

    return (
        <div className="welcome-page">
            <div className="welcome-glow welcome-glow-one" />
            <div className="welcome-glow welcome-glow-two" />

            <nav className="welcome-nav welcome-enter" style={{ animationDelay: '40ms' }}>
                <Link to="/" className="welcome-brand" aria-label="AiTaLab LabSync home">
                    <img src={logo} alt="AiTaLab" />
                    <span>
                        AiTaLab <em>LabSync</em>
                    </span>
                </Link>

                <Link to={isLoggedIn ? appPath : '/login'} className="welcome-signin-link">
                    {isLoggedIn ? 'Go to App' : 'Sign In'}
                </Link>
            </nav>

            <main className="welcome-main">
                <section className="welcome-hero">
                    <div className="welcome-copy welcome-enter" style={{ animationDelay: '120ms' }}>
                        <div className="welcome-pill">
                            <Sparkles size={14} />
                            Research Operations Platform
                        </div>

                        <h1>
                            Turn Lab Plans Into
                            <span> Repeatable Momentum.</span>
                        </h1>

                        <p>
                            LabSync helps your team coordinate projects, papers, bookings, and seminars in one bright,
                            practical workspace built for research labs.
                        </p>

                        <div className="welcome-actions">
                            <Link to={isLoggedIn ? appPath : '/login'} className="welcome-cta-primary">
                                {isLoggedIn ? 'Open Workspace' : 'Get Started'}
                                <ArrowRight size={16} />
                            </Link>
                            <a href="#features" className="welcome-cta-secondary">Explore Features</a>
                        </div>

                        <div className="welcome-stats">
                            {highlights.map((item) => (
                                <article key={item.label} className="welcome-stat-card">
                                    <strong>{item.value}</strong>
                                    <span>{item.label}</span>
                                </article>
                            ))}
                        </div>
                    </div>

                    <aside className="welcome-showcase welcome-enter" style={{ animationDelay: '220ms' }}>
                        <div className="welcome-showcase-head">
                            <h3>Today at a glance</h3>
                            <span>Live status</span>
                        </div>
                        <div className="welcome-showcase-list">
                            <div className="welcome-showcase-row">
                                <span className="welcome-tag welcome-tag-orange">Seminar</span>
                                <p>AI Vision seminar starts in 35 minutes</p>
                            </div>
                            <div className="welcome-showcase-row">
                                <span className="welcome-tag welcome-tag-blue">Resources</span>
                                <p>4 microscopes are available for booking</p>
                            </div>
                            <div className="welcome-showcase-row">
                                <span className="welcome-tag welcome-tag-green">Tasks</span>
                                <p>9 milestones moved to completed this week</p>
                            </div>
                        </div>
                    </aside>
                </section>

                <section id="features" className="welcome-features">
                    <header className="welcome-features-head welcome-enter" style={{ animationDelay: '180ms' }}>
                        <h2>Everything your lab needs, in one clear flow</h2>
                        <p>Designed for researchers, supervisors, and lab coordinators who need visibility without friction.</p>
                    </header>

                    <div className="welcome-features-grid">
                        {features.map((feature, index) => (
                            <article
                                key={feature.title}
                                className="welcome-feature-card welcome-enter"
                                style={{ animationDelay: `${260 + index * 70}ms` }}
                            >
                                <div className="welcome-feature-icon">{feature.icon}</div>
                                <h3>{feature.title}</h3>
                                <p>{feature.desc}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="welcome-cta-panel welcome-enter" style={{ animationDelay: '700ms' }}>
                    <h2>Ready to coordinate your next research cycle?</h2>
                    <p>Sign in with your institutional account and continue inside LabSync.</p>
                    <Link to={isLoggedIn ? appPath : '/login'} className="welcome-cta-primary">
                        {isLoggedIn ? 'Go to App' : 'Sign In Now'}
                        <ArrowRight size={16} />
                    </Link>
                </section>
            </main>

            <footer className="welcome-footer">
                <span>© {new Date().getFullYear()} AiTaLab. All rights reserved.</span>
                <div>
                    <Link to="/privacy">Privacy Policy</Link>
                    <Link to="/terms">Terms of Service</Link>
                    <a href="mailto:contact@aitalab.edu.vn">Contact</a>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
