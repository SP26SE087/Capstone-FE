import React from 'react';
import { Link } from 'react-router-dom';
import logo from '@/assets/aita.png';

const LAST_UPDATED = 'April 18, 2025';
const ORG_NAME = 'AiTaLab';
const SYSTEM_NAME = 'LabSync';
const CONTACT_EMAIL = 'contact@aitalab.edu.vn';

const TermsPage: React.FC = () => (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Be Vietnam Pro, sans-serif' }}>
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
                <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>Terms of Service</h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Last updated: {LAST_UPDATED}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', color: '#334155', lineHeight: 1.8 }}>

                <Section title="1. Acceptance of Terms">
                    <p>
                        By accessing or using the <strong>{SYSTEM_NAME}</strong> platform operated by <strong>{ORG_NAME}</strong>,
                        you agree to be bound by these Terms of Service and our{' '}
                        <Link to="/privacy" style={{ color: '#e8720c' }}>Privacy Policy</Link>.
                        If you do not agree to these terms, you must not access or use the system.
                    </p>
                </Section>

                <Section title="2. Eligibility">
                    <p>
                        Access to {SYSTEM_NAME} is restricted to individuals who have been officially registered by an authorized
                        {ORG_NAME} administrator. Self-registration is not permitted. You must be a current student, researcher,
                        or staff member affiliated with {ORG_NAME} to use this system.
                    </p>
                </Section>

                <Section title="3. Account Responsibilities">
                    <p>You are responsible for:</p>
                    <ul>
                        <li>Maintaining the confidentiality of your Google account credentials used to access {SYSTEM_NAME}.</li>
                        <li>All activities that occur under your account.</li>
                        <li>Ensuring your profile information (name, student ID, contact details) is accurate and up to date.</li>
                        <li>Notifying the system administrator immediately if you suspect unauthorized access to your account.</li>
                    </ul>
                </Section>

                <Section title="4. Permitted Use">
                    <p>You may use {SYSTEM_NAME} solely for legitimate laboratory management activities, including:</p>
                    <ul>
                        <li>Managing and tracking research projects and tasks.</li>
                        <li>Recording and viewing laboratory attendance logs.</li>
                        <li>Submitting and reviewing research reports and paper submissions.</li>
                        <li>Booking and managing laboratory resources.</li>
                        <li>Communicating and collaborating with other registered lab members.</li>
                    </ul>
                </Section>

                <Section title="5. Prohibited Activities">
                    <p>You must not:</p>
                    <ul>
                        <li>Access, tamper with, or use accounts of other users without authorization.</li>
                        <li>Attempt to circumvent authentication, authorization, or security mechanisms.</li>
                        <li>Upload or transmit malicious code, malware, or harmful content.</li>
                        <li>Use the system to harass, intimidate, or harm other users.</li>
                        <li>Share your account credentials with others.</li>
                        <li>Use {SYSTEM_NAME} for any purpose that violates applicable laws or regulations.</li>
                        <li>Attempt to reverse-engineer, scrape, or extract data from the system in unauthorized ways.</li>
                    </ul>
                </Section>

                <Section title="6. Biometric Enrollment">
                    <p>
                        As part of laboratory access control, you may be required to enroll your facial biometric data.
                        By completing biometric enrollment, you explicitly consent to the collection and processing of your
                        biometric information for attendance verification purposes as described in the{' '}
                        <Link to="/privacy" style={{ color: '#e8720c' }}>Privacy Policy</Link>.
                    </p>
                </Section>

                <Section title="7. Intellectual Property">
                    <p>
                        All research outputs, reports, and materials submitted through {SYSTEM_NAME} remain the intellectual
                        property of the respective authors and {ORG_NAME}, subject to applicable institutional policies.
                        The {SYSTEM_NAME} platform itself, including its software, design, and content, is the property of
                        {ORG_NAME} and is protected by applicable intellectual property laws.
                    </p>
                </Section>

                <Section title="8. Data and Content">
                    <p>
                        You retain ownership of content you submit to {SYSTEM_NAME} (such as reports and research materials).
                        By submitting content, you grant {ORG_NAME} a non-exclusive license to store, display, and use such
                        content within the scope of operating the {SYSTEM_NAME} platform.
                    </p>
                </Section>

                <Section title="9. System Availability">
                    <p>
                        {ORG_NAME} will make reasonable efforts to keep {SYSTEM_NAME} available, but does not guarantee uninterrupted
                        or error-free operation. Scheduled maintenance, updates, or events beyond our control may cause temporary
                        unavailability.
                    </p>
                </Section>

                <Section title="10. Limitation of Liability">
                    <p>
                        To the fullest extent permitted by law, {ORG_NAME} shall not be liable for any indirect, incidental,
                        special, or consequential damages arising from your use of or inability to use {SYSTEM_NAME}, including
                        loss of data or research materials.
                    </p>
                </Section>

                <Section title="11. Account Termination">
                    <p>
                        {ORG_NAME} reserves the right to suspend or deactivate accounts that violate these Terms of Service,
                        upon completion of laboratory programs, or at the discretion of authorized administrators. You may also
                        request account deactivation by contacting the system administrator.
                    </p>
                </Section>

                <Section title="12. Changes to Terms">
                    <p>
                        These Terms of Service may be updated from time to time. The "Last updated" date at the top of this page
                        reflects the most recent revision. Continued use of {SYSTEM_NAME} following any changes constitutes
                        your acceptance of the revised terms.
                    </p>
                </Section>

                <Section title="13. Contact">
                    <p>
                        For questions regarding these Terms of Service, please contact the {ORG_NAME} system administrator at{' '}
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

export default TermsPage;
