import React, { useEffect, useState } from 'react';
import api from '@/services/api';

interface TestUser {
    id: string;
    userName: string;
    email: string;
    roles: string[];
}

const DevLoginPage: React.FC = () => {
    const [users, setUsers] = useState<TestUser[]>([]);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/test/users');
            setUsers(response.data);
        } catch (err) {
            console.error('Failed to fetch test users', err);
            setError('Could not fetch test users. Make sure the backend is running.');
        }
    };

    const handleGetTokenByRole = async (role: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/api/test/token/${role}`);
            const newToken = response.data?.data?.token || response.data?.token || response.data;
            saveToken(newToken);
        } catch (err) {
            setError(`Failed to get token for role ${role}`);
        } finally {
            setLoading(false);
        }
    };

    const handleGetTokenByUser = async (userId: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/api/test/token/user/${userId}`);
            const newToken = response.data?.data?.token || response.data?.token || response.data;
            saveToken(newToken);
        } catch (err) {
            setError(`Failed to get token for user ${userId}`);
        } finally {
            setLoading(false);
        }
    };

    const saveToken = (newToken: any) => {
        if (typeof newToken === 'string' && newToken.length > 0) {
            localStorage.setItem('token', newToken);
            setToken(newToken);
        } else {
            setError('Invalid token response format');
        }
    };

    const clearToken = () => {
        localStorage.removeItem('token');
        setToken(null);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1>Dev Token Manager</h1>
            <p>Use this page to quickly get JWT tokens for development and testing.</p>

            {error && (
                <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            <section style={{ marginBottom: '2rem' }}>
                <h2>Current Token</h2>
                {token ? (
                    <div style={{ wordBreak: 'break-all', padding: '1rem', background: '#f3f4f6', borderRadius: '4px', fontSize: '0.8rem', color: '#111827' }}>
                        {token}
                        <div style={{ marginTop: '1rem' }}>
                            <button onClick={clearToken} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                                Clear Token
                            </button>
                        </div>
                    </div>
                ) : (
                    <p>No token set.</p>
                )}
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2>Quick Roles</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => handleGetTokenByRole('Admin')}
                        disabled={loading}
                        style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        Get Admin Token
                    </button>
                    <button
                        onClick={() => handleGetTokenByRole('LabDirector')}
                        disabled={loading}
                        style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        Get Lab Director Token
                    </button>
                </div>
            </section>

            <section>
                <h2>Test Users</h2>
                {users.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                                <th style={{ padding: '0.5rem' }}>Username</th>
                                <th style={{ padding: '0.5rem' }}>Roles</th>
                                <th style={{ padding: '0.5rem' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.5rem' }}>{user.userName}</td>
                                    <td style={{ padding: '0.5rem' }}>
                                        {user.roles.map(role => (
                                            <span key={role} style={{
                                                display: 'inline-block',
                                                padding: '0.2rem 0.5rem',
                                                background: '#d1fae5',
                                                color: '#065f46',
                                                borderRadius: '9999px',
                                                fontSize: '0.7rem',
                                                marginRight: '0.25rem'
                                            }}>
                                                {role}
                                            </span>
                                        ))}
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <button
                                            onClick={() => handleGetTokenByUser(user.id)}
                                            disabled={loading}
                                            style={{ padding: '0.4rem 0.8rem', cursor: 'pointer', background: '#6366f1', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.8rem' }}
                                        >
                                            Login
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>No test users found or loading...</p>
                )}
            </section>
        </div>
    );
};

export default DevLoginPage;
