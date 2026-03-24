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
                target: 'https://127.0.0.1:7268',
                changeOrigin: true,
                secure: false,
            },
            '/api/users': {
                target: 'https://127.0.0.1:7268',
                changeOrigin: true,
                secure: false,
            },
            '/api/papersubmissions': {
                target: 'https://127.0.0.1:7252',
                changeOrigin: true,
                secure: false,
            },
            '/api': {
                target: 'https://127.0.0.1:7215',
                changeOrigin: true,
                secure: false,
            },
        },
    },
})
