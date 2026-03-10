import { useState, useEffect } from 'react';

const decodeToken = (token: string | null) => {
    if (!token) return { name: "Guest User", role: "Visitor" };
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) throw new Error("Invalid token format");

        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const decoded = JSON.parse(jsonPayload);
        const role = decoded.role || decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || "User";
        const name = decoded.unique_name || decoded.name || "Logged In User";

        return { name, role };
    } catch (error) {
        console.error("Failed to decode token", error);
        return { name: "Guest User", role: "Visitor" };
    }
};

export const useAuth = () => {
    const [user, setUser] = useState<{ name: string; role: string }>(() => {
        return decodeToken(localStorage.getItem('token'));
    });
    const loading = false;

    useEffect(() => {
        const token = localStorage.getItem('token');
        setUser(decodeToken(token));
    }, []);

    return { user, loading, isAuthenticated: user.role !== "Visitor" };
};
