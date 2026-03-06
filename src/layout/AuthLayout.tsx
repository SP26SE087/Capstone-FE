import React from 'react';

const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <h1>Lab Management</h1>
                </div>
                {children}
            </div>
        </div>
    );
};

export default AuthLayout;
