import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
// https://vitejs.dev/config/
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var isServerMode = true; // Set to true to use server URLs, false for local URLs
    var serverUrl = env.VITE_SERVER_URL;
    var getTarget = function (localUrl) { return (isServerMode ? serverUrl : localUrl); };
    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        server: {
            headers: {
                'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
                'Cross-Origin-Embedder-Policy': 'unsafe-none',
            },
            proxy: {
                '/api/auth': {
                    target: getTarget('https://localhost:7268'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/user-projects': {
                    target: getTarget('https://localhost:7215'),
                    changeOrigin: true,
                    secure: false,
                    rewrite: function (path) { return path.replace('/api/users'); },
                },
                '^/api/users/[^/]+/projects': {
                    target: getTarget('https://localhost:7215'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/users': {
                    target: getTarget('https://localhost:7268'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/Meetings': {
                    target: getTarget('https://localhost:7276'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/Seminars': {
                    target: getTarget('https://localhost:7276'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/bookings': {
                    target: getTarget('https://localhost:7162'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/resources': {
                    target: getTarget('https://localhost:7162'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/equipment-logs': {
                    target: getTarget('https://localhost:7162'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/resource-types': {
                    target: getTarget('https://localhost:7162'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/Transcriptions': {
                    target: getTarget('https://localhost:7003'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/tasks/suggest': {
                    target: getTarget('https://localhost:7003'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/Reports': {
                    target: getTarget('https://localhost:7262'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api/papersubmissions': {
                    target: getTarget('https://localhost:7252'),
                    changeOrigin: true,
                    secure: false,
                },
                '/api': {
                    target: getTarget('https://localhost:7215'),
                    changeOrigin: true,
                    secure: false,
                },
                '/face': {
                    target: env.VITE_FACE_SERVER_URL || 'http://localhost:5000',
                    changeOrigin: true,
                    secure: false,
                    rewrite: function (path) { return path.replace(/^\/face/, ''); },
                },
            },
        },
    };
});
