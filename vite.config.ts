import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        proxy: {
            '/api/auth': {
                target: 'https://localhost:7268',
                changeOrigin: true,
                secure: false,
            },
            '/api/users': {
                target: 'https://localhost:7268',
                changeOrigin: true,
                secure: false,
            },
            '/api/bookings': {
                target: 'https://localhost:7162',
                changeOrigin: true,
                secure: false,
            },
            '/api/resources': {
                target: 'https://localhost:7162',
                changeOrigin: true,
                secure: false,
            },
            '/api/equipment-logs': {
                target: 'https://localhost:7162',
                changeOrigin: true,
                secure: false,
            },
            '/api/Reports': {
                target: 'https://localhost:7262',
                changeOrigin: true,
                secure: false,
            },
            '/api/papersubmissions': {
                target: 'https://localhost:7252',
                changeOrigin: true,
                secure: false,
            },
            '/api': {
                target: 'https://localhost:7215',
                changeOrigin: true,
                secure: false,
            },
        },
    },
})
