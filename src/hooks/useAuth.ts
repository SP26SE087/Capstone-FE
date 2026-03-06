import { useState, useEffect } from 'react';

export const useAuth = () => {
    const [user, setUser] = useState<{ name: string; role: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mocking auth check
        setTimeout(() => {
            setUser({ name: "Alex Rivera", role: "Lab Director" });
            setLoading(false);
        }, 500);
    }, []);

    return { user, loading, isAuthenticated: !!user };
};
