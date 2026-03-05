import React from 'react';
import { User, Bell, Search } from 'lucide-react';

const Header: React.FC = () => {
    return (
        <header className="top-header">
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ position: 'relative', width: '300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Search projects, tasks..."
                        style={{
                            width: '100%',
                            padding: '8px 12px 8px 40px',
                            borderRadius: '20px',
                            border: '1px solid var(--border-color)',
                            background: '#f1f3f5',
                            fontSize: '0.9rem',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <Bell size={20} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifySelf: 'center', color: 'white', justifyContent: 'center' }}>
                        <User size={18} />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Admin</span>
                </div>
            </div>
        </header>
    );
};

export default Header;
