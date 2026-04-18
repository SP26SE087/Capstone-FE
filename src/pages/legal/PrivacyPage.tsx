import React from 'react';
import { Link } from 'react-router-dom';
import logo from '@/assets/aita.png';

const LAST_UPDATED = 'April 18, 2025';
const ORG_NAME = 'AiTaLab';
const SYSTEM_NAME = 'LabSync';
const CONTACT_EMAIL = 'contact@aitalab.edu.vn';

const PrivacyPage: React.FC = () => (
    <div style={{ minHeight: 'calc(100vh / 0.9)', background: '#f8fafc', fontFamily: 'Be Vietnam Pro, sans-serif' }}>
        {/* Header */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                <img src={logo} alt="AiTaLab" style={{ height: '36px', width: '36px', objectFit: 'contain' }} />
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{ORG_NAME} <span style={{ color: '#e8720c' }}>{SYSTEM_NAME}</span></span>
            </Link>
        </header>

        {/* Content */}
        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 2rem' }}>
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>Privacy Policy</h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Last updated: {LAST_UPDATED}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', color: '#334155', lineHeight: 1.8 }}>

                <Section title="1. Introduction">
                    <p>
                        {ORG_NAME} operates the <strong>{SYSTEM_NAME}</strong> laboratory management platform. This Privacy Policy explains how we collect,
                        use, store, and protect personal information of users who access and use the {SYSTEM_NAME} system.
                        By using {SYSTEM_NAME}, you agree to the practices described in this policy.
                    </p>
                </Section>

                <Section title="2. Information We Collect">
                    <p>We collect the following categories of personal information:</p>
                    <ul>
                        <li><strong>Identity data:</strong> Full name, student ID, email address.</li>
                        <li><strong>Contact data:</strong> Phone number.</li>
                        <li><strong>Academic data:</strong> ORCID, Google Scholar URL, GitHub profile URL, institutional affiliation.</li>
                        <li><strong>Authentication data:</strong> Google account credentials (via OAuth 2.0 — we do not store your password).</li>
                        <li><strong>Biometric data:</strong> Facial recognition data collected for attendance and access verification purposes.</li>
                        <li><strong>Usage data:</strong> Check-in logs, project activity, task assignments, and report submissions.</li>
                    </ul>
                </Section>

                <Section title="3. How We Use Your Information">
                    <p>Your personal information is used solely to operate and improve the {SYSTEM_NAME} system, including:</p>
                    <ul>
                        <li>Authenticating and managing your lab account.</li>
                        <li>Recording attendance and laboratory access via biometric verification.</li>
                        <li>Assigning and tracking research projects and tasks.</li>
                        <li>Generating lab activity reports and analytics.</li>
                        <li>Communicating system notifications and updates.</li>
                        <li>Fulfilling administrative and compliance obligations of {ORG_NAME}.</li>
                    </ul>
                </Section>

                <Section title="4. Biometric Data">
                    <p>
                        Facial recognition data is collected exclusively for attendance and lab access control. Biometric data is:
                    </p>
                    <ul>
                        <li>Stored in encrypted form on {ORG_NAME}'s secured servers.</li>
                        <li>Used only for identity verification within {SYSTEM_NAME}.</li>
                        <li>Never sold, licensed, or shared with any third party.</li>
                        <li>Deleted upon account deactivation or upon formal written request.</li>
                    </ul>
                </Section>

                <Section title="5. Data Sharing">
                    <p>
                        We do not sell, trade, or transfer your personal data to external parties. Data may be disclosed only in the
                        following limited circumstances:
                    </p>
                    <ul>
                        <li>To authorized {ORG_NAME} administrators for system management purposes.</li>
                        <li>When required by applicable law, court order, or governmental regulation.</li>
                        <li>To protect the rights, safety, or property of {ORG_NAME} or its members.</li>
                    </ul>
                </Section>

                <Section title="6. Data Security">
                    <p>
                        We implement appropriate technical and organizational measures to protect your personal data against unauthorized
                        access, loss, or disclosure. These measures include encrypted data transmission (HTTPS), access control policies,
                        and regular security reviews. However, no system is completely immune to security risks.
                    </p>
                </Section>

                <Section title="7. Data Retention">
                    <p>
                        Personal data is retained for as long as your account remains active and as required to fulfill the purposes
                        described in this policy. Upon deactivation of your account, data may be retained for up to 12 months for
                        audit and compliance purposes before being permanently deleted.
                    </p>
                </Section>

                <Section title="8. Your Rights">
                    <p>Depending on applicable law, you may have the right to:</p>
                    <ul>
                        <li>Access and review your personal data stored in the system.</li>
                        <li>Request correction of inaccurate or incomplete data.</li>
                        <li>Request deletion of your personal data.</li>
                        <li>Object to certain processing activities.</li>
                    </ul>
                    <p>To exercise any of these rights, please contact us at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#e8720c' }}>{CONTACT_EMAIL}</a>.</p>
                </Section>

                <Section title="9. Cookies">
                    <p>
                        {SYSTEM_NAME} uses session storage and browser local storage to maintain authentication state and user preferences.
                        No third-party advertising cookies are used.
                    </p>
                </Section>

                <Section title="10. Changes to This Policy">
                    <p>
                        We may update this Privacy Policy from time to time. Changes will be reflected by the "Last updated" date at the
                        top of this page. Continued use of {SYSTEM_NAME} after any changes constitutes your acceptance of the updated policy.
                    </p>
                </Section>

                <Section title="11. Contact">
                    <p>
                        For questions or concerns regarding this Privacy Policy, please contact the {ORG_NAME} system administrator at{' '}
                        <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#e8720c' }}>{CONTACT_EMAIL}</a>.
                    </p>
                </Section>

            </div>
        </main>

        <Footer />
    </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.6rem', borderLeft: '3px solid #e8720c', paddingLeft: '12px' }}>
            {title}
        </h2>
        <div style={{ paddingLeft: '15px', fontSize: '0.92rem' }}>{children}</div>
    </section>
);

const Footer: React.FC = () => (
    <footer style={{ borderTop: '1px solid #e2e8f0', padding: '1.5rem 2rem', textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8', background: '#fff', marginTop: '2rem' }}>
        <span>© {new Date().getFullYear()} {ORG_NAME}. All rights reserved. </span>
        <Link to="/privacy" style={{ color: '#e8720c', marginLeft: '12px', textDecoration: 'none' }}>Privacy Policy</Link>
        <Link to="/terms" style={{ color: '#e8720c', marginLeft: '12px', textDecoration: 'none' }}>Terms of Service</Link>
        <Link to="/login" style={{ color: '#64748b', marginLeft: '12px', textDecoration: 'none' }}>Back to Login</Link>
    </footer>
);

export default PrivacyPage;
