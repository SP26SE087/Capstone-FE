import MainLayout from '@/layout/MainLayout';
import {
    BarChart3,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

function App() {
    const stats = [
        { label: 'Active Projects', value: 12, icon: <BarChart3 size={20} />, color: '#01497c' },
        { label: 'Pending Tasks', value: 24, icon: <Clock size={20} />, color: '#2a6f97' },
        { label: 'Completed Tasks', value: 156, icon: <CheckCircle2 size={20} />, color: '#10b981' },
        { label: 'Due Soon', value: 5, icon: <AlertCircle size={20} />, color: '#e63946' },
    ];

    return (
        <MainLayout>
            <div style={{ maxWidth: '1200px' }}>
                <header style={{ marginBottom: '2rem' }}>
                    <h1>Lab Dashboard</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Overview of lab activities and prioritized priorities.</p>
                </header>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '2.5rem'
                }}>
                    {stats.map((stat, index) => (
                        <div key={index} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.25rem' }}>
                            <div style={{
                                background: `${stat.color}15`,
                                color: stat.color,
                                padding: '12px',
                                borderRadius: '12px'
                            }}>
                                {stat.icon}
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{stat.label}</p>
                                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0 }}>Priority Tasks</h3>
                                <Link to="/tasks" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-color)' }}>
                                    View All <ArrowUpRight size={14} />
                                </Link>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[1, 2, 3].map((task) => (
                                    <div key={task} style={{
                                        padding: '1rem',
                                        background: '#f8f9fa',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 600 }}>PROJECT-0{task}</span>
                                            <p style={{ margin: '4px 0', fontSize: '0.95rem', fontWeight: 500 }}>Submit Research Report Section {task}</p>
                                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                <span>Deadline: Oct 12, 2026</span>
                                                <span>•</span>
                                                <span>Assigned to: Member A</span>
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '4px 12px',
                                            background: '#fff',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem'
                                        }}>
                                            In Progress
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <section className="card">
                            <h3 style={{ marginBottom: '1.25rem' }}>Upcoming Seminar</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ borderLeft: '3px solid var(--accent-color)', paddingLeft: '1rem' }}>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Weekly Lab Meeting</p>
                                    <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Oct 10, 09:00 AM - Room 402</p>
                                </div>
                                <div style={{ borderLeft: '3px solid #dee2e6', paddingLeft: '1rem' }}>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Ethics in AI Seminar</p>
                                    <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Oct 15, 02:00 PM - Online</p>
                                </div>
                            </div>
                        </section>

                        <section className="card" style={{ background: 'var(--primary-color)', color: 'white' }}>
                            <h4 style={{ color: 'white', marginBottom: '0.75rem' }}>System Notice</h4>
                            <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Lab resources for GPU servers are currently at 80% capacity.</p>
                            <button style={{
                                marginTop: '1rem',
                                width: '100%',
                                padding: '10px',
                                background: 'white',
                                color: 'var(--primary-color)',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}>
                                Book Resource
                            </button>
                        </section>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}

export default App;
